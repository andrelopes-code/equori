package ledger_test

import (
	"net/http"
	"slices"
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

// A version for a month that already has one replaces it, as a budget plan replaces the
// version of its month; the statements and postings follow the replacing version (A86, I08).
func TestBillingRuleVersionReplaces(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-12-01")
	c.purchase("2026-11-20", 10000)
	c.purchase("2026-12-03", 20000)

	for _, closingDay := range []int{4, 2} {
		c.h.MustDo(
			http.MethodPost,
			"/api/v1/accounts/"+c.card+"/billing-cycle-rules",
			map[string]any{
				"effective_from":         "2026-12",
				"closing_day":            closingDay,
				"due_day":                10,
				"closing_day_assignment": "next",
			},
			http.StatusCreated,
			nil,
		)
	}

	var rules struct {
		Items []struct {
			EffectiveFrom string `json:"effective_from"`
			ClosingDay    int    `json:"closing_day"`
		} `json:"items"`
	}
	c.h.MustDo(
		http.MethodGet,
		"/api/v1/accounts/"+c.card+"/billing-cycle-rules",
		nil,
		http.StatusOK,
		&rules,
	)

	var december []int
	for _, r := range rules.Items {
		if r.EffectiveFrom == "2026-12" {
			december = append(december, r.ClosingDay)
		}
	}

	if !slices.Equal(december, []int{2}) {
		t.Fatalf("closing days of the 2026-12 versions = %v, want [2]", december)
	}

	ss := statements(t, c.h, c.card)
	if s := ss["2026-12"]; s.Closing != "2026-12-02" || s.Charges != 10000 {
		t.Fatalf("2026-12 = closing %s charges %d, want 2026-12-02 10000", s.Closing, s.Charges)
	}

	if s := ss["2027-01"]; s.Closing != "2027-01-02" || s.Charges != 20000 {
		t.Fatalf("2027-01 = closing %s charges %d, want 2027-01-02 20000", s.Closing, s.Charges)
	}
}
