package ledger_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type accountDetailsOut struct {
	Card *struct {
		Placement *struct {
			Reference string `json:"reference"`
		} `json:"placement"`
		Statements []struct {
			Reference string `json:"reference"`
		} `json:"statements"`
	} `json:"card"`
}

func TestGetAccountDetailsCard(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-11-05", 10000)
	var got accountDetailsOut
	toolOutput(
		t,
		c.h,
		"get_account_details",
		map[string]any{"account_id": c.card, "purchase_date": "2026-11-05"},
		&got,
	)

	if got.Card == nil || got.Card.Placement == nil || got.Card.Placement.Reference != "2026-12" {
		t.Fatalf("card = %+v", got.Card)
	}

	if len(got.Card.Statements) != 1 || got.Card.Statements[0].Reference != "2026-12" {
		t.Errorf("statements = %+v", got.Card.Statements)
	}
}

func TestGetAccountDetailsNotCard(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-23"))
	checking := h.Account("Checking", "asset", "checking", nil)
	h.ExpectToolError(
		h.Tool("get_account_details", map[string]any{"account_id": checking, "month": "2026-11"}),
		"invalid_arguments",
		"month",
	)
	h.ExpectToolError(
		h.Tool(
			"get_account_details",
			map[string]any{"account_id": checking, "purchase_date": "2026-11-05"},
		),
		"invalid_arguments",
		"purchase_date",
	)
	var got accountDetailsOut
	toolOutput(t, h, "get_account_details", map[string]any{"account_id": checking}, &got)

	if got.Card != nil {
		t.Errorf("card = %+v", got.Card)
	}
}

func TestGetAccountDetailsOtherUser(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-10-23"))
	var a struct {
		ID string `json:"id"`
	}
	h.Call(h.Login("other@example.com"), http.MethodPost, "/api/v1/accounts", map[string]any{"name": "A", "class": "asset", "currency": "BRL", "kind": "checking"}).
		Decode(t, &a)
	h.ExpectToolError(
		h.Tool("get_account_details", map[string]any{"account_id": a.ID}),
		"not_found",
		"",
	)
}

// The cycle versions the statements of this month and later follow, with their closing mode
// and calendar shifts: the version in force this month and every later one.
func TestGetAccountDetailsBillingCycles(t *testing.T) {
	t.Parallel()

	c := newCardSetup(t, "2026-11-12")
	for _, rule := range []map[string]any{
		{"effective_from": "2026-06", "closing_day": 5, "due_day": 12},
		{
			"effective_from":          "2026-12",
			"closing_mode":            "before_due",
			"closing_days_before_due": 7,
			"closing_adjustment":      "preceding",
			"due_day":                 10,
		},
	} {
		c.h.MustDo(
			http.MethodPost,
			"/api/v1/accounts/"+c.card+"/billing-cycle-rules",
			rule,
			http.StatusCreated,
			nil,
		)
	}

	var got struct {
		Card struct {
			BillingCycles []billingCycleOut `json:"billing_cycles"`
		} `json:"card"`
	}

	toolOutput(t, c.h, "get_account_details", map[string]any{"account_id": c.card}, &got)

	want := []billingCycleOut{
		{"2026-06", "day", 5, 0, "none", 12, "following", "next", "br_banking"},
		{"2026-12", "before_due", 0, 7, "preceding", 10, "following", "next", "br_banking"},
	}
	if !slices.Equal(got.Card.BillingCycles, want) {
		t.Fatalf("billing_cycles = %+v, want %+v", got.Card.BillingCycles, want)
	}
}

type billingCycleOut struct {
	EffectiveFrom        string `json:"effective_from"`
	ClosingMode          string `json:"closing_mode"`
	ClosingDay           int    `json:"closing_day"`
	ClosingDaysBeforeDue int    `json:"closing_days_before_due"`
	ClosingAdjustment    string `json:"closing_adjustment"`
	DueDay               int    `json:"due_day"`
	DueDateAdjustment    string `json:"due_date_adjustment"`
	ClosingDayAssignment string `json:"closing_day_assignment"`
	Calendar             string `json:"calendar"`
}
