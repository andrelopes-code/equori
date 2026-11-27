package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// A86: a new rule version re-dates the statements from its effective month whose closing date
// has not passed, the closing day included; re-dating bills again the postings billed by a date
// that the new dates move; a statement with the owner's facts keeps the facts' dates.
func TestBillingRuleVersionRedates(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name        string
		today       string
		facts       bool
		wantClosing string
		wantCharges brl
		wantStatus  string
	}{
		{"closing today", "2026-12-03", false, "2026-12-04", 30000, "open"},
		{"closing passed", "2026-12-04", false, "2026-12-03", 10000, "closed"},
		{"owner facts", "2026-12-01", true, "2026-12-02", 10000, "open"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			c := newCardSetup(t, tc.today)
			c.purchase("2026-11-20", 10000)
			c.purchase("2026-12-03", 20000)

			if tc.facts {
				c.h.MustDo(
					http.MethodPut,
					"/api/v1/statements/"+c.statementID(t, "2026-12")+"/facts",
					map[string]any{
						"closing_date": "2026-12-02",
						"due_date":     "2026-12-10",
						"total":        apitest.BRL(10000),
					},
					http.StatusOK,
					nil,
				)
			}

			c.h.MustDo(
				http.MethodPost,
				"/api/v1/accounts/"+c.card+"/billing-cycle-rules",
				map[string]any{
					"effective_from":         "2026-12",
					"closing_day":            4,
					"due_day":                10,
					"closing_day_assignment": "next",
				},
				http.StatusCreated,
				nil,
			)

			ss := statements(t, c.h, c.card)

			s := ss["2026-12"]
			if s.Closing != tc.wantClosing || s.Charges != tc.wantCharges ||
				s.Status != tc.wantStatus {
				t.Fatalf(
					"2026-12 = closing %s charges %d status %s, want %s %d %s",
					s.Closing,
					s.Charges,
					s.Status,
					tc.wantClosing,
					tc.wantCharges,
					tc.wantStatus,
				)
			}

			if next := ss["2027-01"]; next.Closing != "2027-01-04" ||
				next.Charges != 30000-tc.wantCharges {
				t.Fatalf(
					"2027-01 = closing %s charges %d, want 2027-01-04 %d",
					next.Closing,
					next.Charges,
					30000-tc.wantCharges,
				)
			}
		})
	}
}
