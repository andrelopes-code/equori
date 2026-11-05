package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// The settlement of a card statement runs from the outbox, and the seeder confirms the same
// statement over HTTP. When the settlement wins the race the API answers already_reconciled, and
// the statement is in the state the seeder wanted.
func TestReconcileStatementsToleratesASettlementThatWonTheRace(t *testing.T) {
	t.Parallel()

	statements := `{"items":[{"id":"s1","reference":"2026-09","due_date":"2026-10-10","status":"closed",` +
		`"amount_due":{"amount":12000,"currency":"BRL"},"closing_date":"2026-10-03"}]}`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/statements"):
			_, _ = w.Write([]byte(statements))
		case r.Method == http.MethodPut:
			_, _ = w.Write([]byte(`{}`))
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/reconcile"):
			w.WriteHeader(http.StatusConflict)
			_, _ = w.Write([]byte(`{"status":409,"code":"already_reconciled"}`))
		default:
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
	}))
	t.Cleanup(server.Close)

	s := newSeeder(t.Context(), server.URL, server.Client())
	s.today = time.Date(2026, 10, 26, 0, 0, 0, 0, time.UTC)
	s.ids["card.itau"], s.ids["card.nubank"] = "c1", "c2"

	s.reconcileStatements()

	if s.err != nil {
		t.Fatalf("reconcileStatements: %v", s.err)
	}
}

func TestReconcileStatementsStillFailsOnOtherRefusals(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			_, _ = w.Write([]byte(`{"items":[{"id":"s1","reference":"2026-09","due_date":"2026-10-10","status":"closed",` +
				`"amount_due":{"amount":12000,"currency":"BRL"},"closing_date":"2026-10-03"}]}`))

			return
		}

		if r.Method == http.MethodPost {
			w.WriteHeader(http.StatusConflict)
			_, _ = w.Write([]byte(`{"status":409,"code":"version_conflict"}`))

			return
		}

		_, _ = w.Write([]byte(`{}`))
	}))
	t.Cleanup(server.Close)

	s := newSeeder(t.Context(), server.URL, server.Client())
	s.today = time.Date(2026, 10, 26, 0, 0, 0, 0, time.UTC)
	s.ids["card.itau"], s.ids["card.nubank"] = "c1", "c2"

	s.reconcileStatements()

	if s.err == nil || !strings.Contains(s.err.Error(), "version_conflict") {
		t.Fatalf("err = %v, want the version_conflict refusal", s.err)
	}
}
