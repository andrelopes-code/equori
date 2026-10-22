package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// The statement a purchase is billed on, read before the purchase is recorded (T04, A86, A87).
func TestStatementPlacement(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	card := h.Card("Itaú Visa", 3, 10, "next")
	type placement struct {
		Reference           string `json:"reference"`
		ClosingDate         string `json:"closing_date"`
		DueDate             string `json:"due_date"`
		PreviousClosingDate string `json:"previous_closing_date"`
		PreviousDueDate     string `json:"previous_due_date"`
	}
	for _, tc := range []struct {
		date string
		want placement
	}{
		// The rule starts in 2026-01, so the statement of 2026-01 has no previous one.
		{"2026-01-02", placement{"2026-01", "2026-01-03", "2026-01-12", "", ""}},
		{"2026-03-02", placement{"2026-03", "2026-03-03", "2026-03-10", "2026-02-03", "2026-02-10"}},
		{"2026-03-03", placement{"2026-04", "2026-04-03", "2026-04-10", "2026-03-03", "2026-03-10"}},
		{"2026-03-04", placement{"2026-04", "2026-04-03", "2026-04-10", "2026-03-03", "2026-03-10"}},
	} {
		var got placement
		h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/statement-placement?date="+tc.date, nil, http.StatusOK, &got)
		if got != tc.want {
			t.Errorf("placement of %s = %+v, want %+v", tc.date, got, tc.want)
		}
	}

	var statements struct {
		Items []struct{} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/statements", nil, http.StatusOK, &statements)
	if len(statements.Items) != 0 {
		t.Fatalf("statements = %d, want 0: a placement creates no statement", len(statements.Items))
	}
}

func TestStatementPlacementProblems(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	bare := h.Account("Inter Mastercard", "liability", "credit_card", nil)
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/accounts/"+checking+"/statement-placement?date=2026-03-02", nil),
		http.StatusUnprocessableEntity, "validation_failed", "account_id")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/accounts/"+bare+"/statement-placement?date=2026-03-02", nil),
		http.StatusUnprocessableEntity, "validation_failed", "date")
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/accounts/"+bare+"/statement-placement?date=2026-3-2", nil),
		http.StatusBadRequest, "invalid_request", "date")
}

// A86: once the owner's facts re-date a statement, a placement follows the stored dates.
func TestStatementPlacementFollowsStoredDates(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-11-02", 1000)
	c.h.MustDo(http.MethodPut, "/api/v1/statements/"+c.statementID(t, "2026-11")+"/facts",
		map[string]any{"closing_date": "2026-11-01", "due_date": "2026-11-10", "total": apitest.BRL(0)}, http.StatusOK, nil)
	var got struct {
		Reference   string `json:"reference"`
		ClosingDate string `json:"closing_date"`
		DueDate     string `json:"due_date"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/statement-placement?date=2026-10-31", nil, http.StatusOK, &got)
	if got.Reference != "2026-11" || got.ClosingDate != "2026-11-01" || got.DueDate != "2026-11-10" {
		t.Fatalf("placement of 2026-10-31 = %+v, want 2026-11 closing 2026-11-01 due 2026-11-10", got)
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/statement-placement?date=2026-11-01", nil, http.StatusOK, &got)
	if got.Reference != "2026-12" {
		t.Fatalf("placement of 2026-11-01 = %+v, want 2026-12", got)
	}
}
