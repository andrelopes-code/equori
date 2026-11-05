package main

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const testToday = "2026-11-05"

func seedHarness(t *testing.T, date string) (*seeder, config, *apitest.Harness) {
	t.Helper()
	h := apitest.New(t, apitest.Today(date))
	c := h.LoginAs("demo@equori.local", locale.Locale{Language: "pt", Region: "BR"}, "BRL")

	today, err := time.Parse(time.DateOnly, date)
	if err != nil {
		t.Fatal(err)
	}

	return newSeeder(context.Background(), h.URL(), c), config{today: today}, h
}

func TestSeed(t *testing.T) {
	s, cfg, h := seedHarness(t, testToday)
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

			// Spending on the first day of the history moves the balance of that day.
			got := s.balanceOn(a.key, iso(s.start))
			for _, e := range s.entries {
				if e.account == s.id(a.key) && e.date == iso(s.start) && !strings.HasPrefix(e.desc, "Saldo inicial") {
					got -= e.cents
				}
			}

			if got != a.opening {
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

	t.Run("cash accounts", func(t *testing.T) {
		// Each account is checked against the range its use gives it on the last day of the history.
		for _, c := range []struct {
			key      string
			min, max int64
		}{
			{"itau.savings", 1237500, 1400000},   // the savings book yields about 0.65 % a month on R$ 11.250,00.
			{"nubank.reserve", 3300000, 4000000}, // R$ 21.300,00 at the start, R$ 300,00 a month and about 1 % a month.
			{"nubank.checking", 0, 600000},       // the Pix of payday brings it to R$ 4.500,00 and the month spends it.
			{"alelo.meal", 0, 250000},            // the meal card is spent in the month it is credited.
			{"xp.cash", 0, 600000},               // the monthly contribution is invested.
		} {
			got := s.balanceOn(c.key, testToday)
			t.Logf("%s balance on %s = %d", c.key, testToday, got)

			if got < c.min || got > c.max {
				t.Errorf("%s balance on %s = %d, want %d to %d", c.key, testToday, got, c.min, c.max)
			}
		}
	})

	t.Run("monthly spending varies", func(t *testing.T) {
		var expenses []float64

		for _, month := range []string{"2025-10", "2026-10"} {
			var out struct {
				Months []struct {
					Month   string `json:"month"`
					Expense struct {
						Amount int64 `json:"amount"`
					} `json:"expense"`
				} `json:"months"`
			}
			s.do(http.MethodGet, "/reports/indicators?month="+month, nil, &out)

			for _, m := range out.Months {
				expenses = append(expenses, float64(m.Expense.Amount))
			}
		}

		if s.err != nil {
			t.Fatal(s.err)
		}

		slices.Sort(expenses)

		// A household does not spend the same amount twice: at most a quarter of the months fall within 3 % of the median.
		median := expenses[len(expenses)/2]

		close := 0

		for _, e := range expenses {
			if math.Abs(e-median) <= median*.03 {
				close++
			}
		}

		t.Logf("monthly expense: median %.0f, %d of %d months within 3 %% of it", median/100, close, len(expenses))

		if close*4 > len(expenses) {
			t.Errorf("%d of %d months spend within 3 %% of the median, want at most a quarter", close, len(expenses))
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
				if st.DueDate < "2026-11-04" && st.Unpaid.Amount != 0 {
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

		for path, want := range map[string]int{"/positions?date=" + testToday: 12, "/realized-results?year=2026": 2, "/realized-results?year=2025": 1, "/goals": 3} {
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

		// A schedule with a month of history shows that month paid, not skipped.
		if states["realized"] < 100 {
			t.Errorf("realized occurrences in 2026-H1 = %d, want at least 100", states["realized"])
		}

		// No bill of the past stays unpaid: every recorded charge fits its occurrence.
		for _, w := range [][2]string{{"2024-11-01", "2025-10-31"}, {"2025-11-01", "2026-10-31"}, {"2026-11-01", "2026-11-04"}} {
			var past struct {
				Items []struct {
					ScheduleID string `json:"schedule_id"`
					ExpectedOn string `json:"expected_on"`
				} `json:"items"`
			}
			s.do(http.MethodGet, "/occurrences?state=overdue&from="+w[0]+"&to="+w[1], nil, &past)

			for _, o := range past.Items {
				t.Errorf("occurrence of %s on %s is overdue, want realized", s.keyOf(o.ScheduleID), o.ExpectedOn)
			}
		}

		if s.err != nil {
			t.Fatal(s.err)
		}

		if len(budgets.Items) != len(budgetSpecs) {
			t.Errorf("budgets = %d, want %d", len(budgets.Items), len(budgetSpecs))
		}

		// Occurrences before the schedules existed are closed as skipped; the owner sees the upcoming ones as pending.
		var next struct {
			Items []struct {
				State string `json:"state"`
			} `json:"items"`
		}
		s.do(http.MethodGet, "/occurrences?from=2026-11-06&to=2026-12-31", nil, &next)

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

// TestSeedFollowsToday seeds a date other than the default: the lines of the imported statements fall in the three weeks before it.
func TestSeedFollowsToday(t *testing.T) {
	const date = "2026-12-19"

	s, cfg, _ := seedHarness(t, date)
	if err := seed(s, cfg); err != nil {
		t.Fatal(err)
	}

	var imported []string

	cursor := ""
	for {
		var page struct {
			Items []struct {
				Date   string `json:"date"`
				Origin string `json:"origin"`
			} `json:"items"`
			NextCursor string `json:"next_cursor"`
		}

		path := "/transactions?limit=200"
		if cursor != "" {
			path += "&cursor=" + url.QueryEscape(cursor)
		}

		s.do(http.MethodGet, path, nil, &page)

		if s.err != nil {
			t.Fatal(s.err)
		}

		for _, it := range page.Items {
			if it.Origin == "import" {
				imported = append(imported, it.Date)
			}
		}

		if cursor = page.NextCursor; cursor == "" {
			break
		}
	}

	if len(imported) == 0 {
		t.Fatal("no imported transaction")
	}

	for _, d := range imported {
		if d < "2026-11-28" || d > date {
			t.Errorf("imported transaction dated %s, want a date from 2026-11-28 to %s", d, date)
		}
	}
}

func (s *seeder) keyOf(id string) string {
	for k, v := range s.ids {
		if v == id {
			return k
		}
	}

	return id
}
