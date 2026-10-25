package main

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const testToday = "2026-10-24"

func seedHarness(t *testing.T) (*seeder, config, *apitest.Harness) {
	t.Helper()
	h := apitest.New(t)
	c := h.LoginAs("demo@equori.local", locale.Locale{Language: "pt", Region: "BR"}, "BRL")
	today, err := time.Parse(time.DateOnly, testToday)
	if err != nil {
		t.Fatal(err)
	}
	return newSeeder(context.Background(), h.URL(), c), config{today: today}, h
}

func TestSeed(t *testing.T) {
	s, cfg, h := seedHarness(t)
	if err := seed(s, cfg); err != nil {
		t.Fatal(err)
	}
	t.Logf("requests: %d", s.calls)
	h.Dispatch()

	t.Run("opening balances", func(t *testing.T) {
		for _, a := range accounts {
			if a.opening == 0 {
				continue
			}
			if got := s.balanceOn(a.key, "2024-10-01"); got != a.opening {
				t.Errorf("opening balance of %s = %d, want %d", a.key, got, a.opening)
			}
		}
		if s.err != nil {
			t.Fatal(s.err)
		}
	})

	t.Run("chart", func(t *testing.T) {
		if got := len(s.listAccounts()); got < 90 {
			t.Errorf("accounts and categories = %d, want at least 90", got)
		}
	})

	t.Run("no overdrawn balance account", func(t *testing.T) {
		for _, key := range []string{"itau.checking", "nubank.checking", "itau.savings", "wallet", "alelo.meal"} {
			got := s.balanceOn(key, testToday)
			t.Logf("%s balance on %s = %d", key, testToday, got)
			if got < 0 {
				t.Errorf("%s balance on %s = %d, want at least 0", key, testToday, got)
			}
		}
	})

	t.Run("every due statement is paid", func(t *testing.T) {
		for _, card := range []string{"card.itau", "card.nubank"} {
			var out struct {
				Items []statementRow `json:"items"`
			}
			s.do(http.MethodGet, "/accounts/"+s.id(card)+"/statements?limit=100", nil, &out)
			if s.err != nil {
				t.Fatal(s.err)
			}
			if len(out.Items) < 24 {
				t.Errorf("%s has %d statements, want at least 24", card, len(out.Items))
			}
			for _, st := range out.Items {
				if st.DueDate < "2026-10-23" && st.Unpaid.Amount != 0 {
					t.Errorf("%s statement due %s is unpaid by %d", card, st.DueDate, st.Unpaid.Amount)
				}
			}
		}
	})

	t.Run("investments", func(t *testing.T) {
		// Positions of the second brokerage appear only after a rebuild, as make demo runs it.
		if err := h.App.Portfolio.RebuildAll(t.Context()); err != nil {
			t.Fatal(err)
		}
		for path, want := range map[string]int{"/positions?date=2026-10-24": 12, "/realized-results?year=2026": 2, "/realized-results?year=2025": 1, "/goals": 3} {
			var out struct {
				Items []json.RawMessage `json:"items"`
			}
			s.do(http.MethodGet, path, nil, &out)
			if s.err != nil {
				t.Fatal(s.err)
			}
			if len(out.Items) < want {
				t.Errorf("%s returned %d items, want at least %d", path, len(out.Items), want)
			}
		}
	})

	t.Run("planning", func(t *testing.T) {
		var occ struct {
			Items []struct {
				State string `json:"state"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/occurrences?from=2026-01-01&to=2026-06-30", nil, &occ)
		var budgets struct {
			Items []json.RawMessage `json:"items"`
		}
		s.do(http.MethodGet, "/budgets", nil, &budgets)
		if s.err != nil {
			t.Fatal(s.err)
		}
		states := map[string]int{}
		for _, o := range occ.Items {
			states[o.State]++
		}
		t.Logf("occurrences 2026-H1 by state: %v", states)
		if len(budgets.Items) != len(budgetSpecs) {
			t.Errorf("budgets = %d, want %d", len(budgets.Items), len(budgetSpecs))
		}
		// Occurrences before the schedules existed are closed as skipped; the owner sees the upcoming ones as pending.
		var next struct {
			Items []struct {
				State string `json:"state"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/occurrences?from=2026-10-25&to=2026-12-31", nil, &next)
		if len(next.Items) < 30 {
			t.Errorf("upcoming occurrences = %d, want at least 30", len(next.Items))
		}
	})

	t.Run("classification", func(t *testing.T) {
		if err := s.runRules(); err != nil {
			t.Fatal(err)
		}
		var out struct {
			Items []struct {
				Description string `json:"description"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/transactions?uncategorized=true", nil, &out)
		if s.err != nil {
			t.Fatal(s.err)
		}
		if len(out.Items) < 3 || len(out.Items) > 6 {
			t.Errorf("uncategorized transactions after the rules = %d, want 3 to 6", len(out.Items))
		}
		for _, it := range out.Items {
			t.Logf("uncategorized: %s", it.Description)
		}
	})

	t.Run("refuses a populated user", func(t *testing.T) {
		again := newSeeder(s.ctx, s.base, s.http)
		if err := seed(again, cfg); err == nil {
			t.Fatal("second seed succeeded, want a refusal")
		}
	})
}

func (s *seeder) balanceOn(key, date string) int64 {
	var out struct {
		Balance struct {
			Amount int64 `json:"amount"`
		} `json:"balance"`
	}
	s.do(http.MethodGet, "/accounts/"+s.id(key)+"/balance?date="+date+"&basis=booked", nil, &out)
	return out.Balance.Amount
}
