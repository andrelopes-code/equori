package planning_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// The database rejects rows that break I07 (occurrence side), I08 for schedule terms,
// overlapping pauses and references to another user's accounts (7.3, 7.6).
func TestSchemaInvariants(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	h := f.h
	id := f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-11-01", 5, ""), nil)
	tx := h.Record("2026-11-05", apitest.Posting(f.checking, -210000), apitest.Posting(f.rent, 210000))
	uid := h.OwnerID()
	ctx := t.Context()
	exec := func(sql string, args ...any) error {
		_, err := h.Pool.Exec(ctx, sql, args...)
		return err
	}
	pause := func(period string) error {
		return exec(`INSERT INTO planning_schedule_pause (user_id, schedule_id, period) VALUES ($1, $2, $3::daterange)`, uid, id, period)
	}
	if err := pause("[2027-02-01,2027-03-31]"); err != nil {
		t.Fatal(err)
	}
	realize := func(sequence int, txID any) error {
		return exec(`UPDATE planning_occurrence SET state = 'realized', transaction_id = $3, realized_by = 'manual'
			WHERE schedule_id = $1 AND sequence = $2`, id, sequence, txID)
	}
	if err := realize(1, tx); err != nil {
		t.Fatal(err)
	}
	other := h.Login("other@example.com")
	var foreign struct {
		ID string `json:"id"`
	}
	r := h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Other", "class": "asset", "kind": "checking", "currency": "BRL"})
	if r.Status != http.StatusCreated {
		t.Fatalf("other account: %d %s", r.Status, r.Body)
	}
	r.Decode(t, &foreign)

	tests := []struct {
		name string
		run  func() error
	}{
		{"terms twice on one date (I08)", func() error {
			return exec(`INSERT INTO planning_schedule_terms (user_id, schedule_id, effective_from, frequency, interval, day_of_month, adjustment, calendar, start, amount)
				VALUES ($1, $2, '2026-11-01', 'monthly', 1, 10, 'none', 'br_banking', '2026-11-01', 100)`, uid, id)
		}},
		{"monthly terms without a selector", func() error {
			return exec(`INSERT INTO planning_schedule_terms (user_id, schedule_id, effective_from, frequency, interval, adjustment, calendar, start, amount)
				VALUES ($1, $2, '2027-01-01', 'monthly', 1, 'none', 'br_banking', '2026-11-01', 100)`, uid, id)
		}},
		{"overlapping pause", func() error { return pause("[2027-03-01,2027-04-30]") }},
		{"one transaction on two occurrences (I07)", func() error { return realize(2, tx) }},
		{"realized without a transaction", func() error {
			return exec(`UPDATE planning_occurrence SET state = 'realized' WHERE schedule_id = $1 AND sequence = 3`, id)
		}},
		{"expected with a transaction", func() error {
			return exec(`UPDATE planning_occurrence SET transaction_id = $2 WHERE schedule_id = $1 AND sequence = 4`, id, tx)
		}},
		{"schedule on another user's account", func() error {
			return exec(`INSERT INTO planning_schedule (user_id, kind, account_id, counterpart_id, description, match_tolerance_bp, grace_days, generated_until)
				VALUES ($1, 'bill', $2, $3, 'x', 1000, 3, '2026-11-01')`, uid, foreign.ID, f.rent)
		}},
		{"same account on both sides", func() error {
			return exec(`INSERT INTO planning_schedule (user_id, kind, account_id, counterpart_id, description, match_tolerance_bp, grace_days, generated_until)
				VALUES ($1, 'transfer', $2, $2, 'x', 1000, 3, '2026-11-01')`, uid, f.checking)
		}},
		{"sequence twice", func() error {
			return exec(`INSERT INTO planning_occurrence (user_id, schedule_id, sequence, expected_on, expected_amount, state)
				VALUES ($1, $2, 1, '2026-11-05', 210000, 'expected')`, uid, id)
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Class 23 is an integrity constraint violation; a typo in the SQL is not.
			if pe, ok := errors.AsType[*pgconn.PgError](tt.run()); !ok || !strings.HasPrefix(pe.Code, "23") {
				t.Fatalf("error = %v, want an integrity constraint violation", pe)
			}
		})
	}
}
