package portfolio_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// TestSaveContributionPlanToolS398 saves the plan of S398 through the tool and reads the values
// and shares of that scenario.
func TestSaveContributionPlanToolS398(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)
	args := f.plan(0)
	args["amount"] = "1500.00"

	var saved struct {
		Status  string `json:"status"`
		Classes []struct {
			Name string `json:"name"`
		} `json:"classes"`
	}
	toolOutput(t, f.h, "save_contribution_plan", args, &saved)

	if saved.Status != "complete" || len(saved.Classes) != 4 ||
		saved.Classes[0].Name != "Fixed income" {
		t.Fatalf("saved = %+v", saved)
	}

	got := f.get(t)
	if !slices.Equal(got.values(), []int64{1000000, 300000, 100000, 400000}) ||
		!slices.Equal(got.shares(t), []int{5555, 1666, 557, 2222}) {
		t.Fatalf("values %v shares %v", got.values(), got.shares(t))
	}

	if got.Amount == nil || got.Amount.Amount != 150000 || got.Amount.Currency != "BRL" {
		t.Fatalf("amount = %+v", got.Amount)
	}
}

func TestSaveContributionPlanToolErrors(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)

	sum := f.plan(0)
	delete(sum, "amount")
	sum["classes"] = []any{
		contributionClass("Fixed income", 4000, map[string]any{"account_id": f.cdb}),
		contributionClass("Equities", 5900, instrumentMember("BOVA11")),
	}
	f.h.ExpectToolError(f.h.Tool("save_contribution_plan", sum), "contribution_target_sum", "")

	amount := f.plan(0)
	amount["amount"] = "x"
	f.h.ExpectToolError(f.h.Tool("save_contribution_plan", amount), "invalid_arguments", "amount")

	member := f.plan(0)
	delete(member, "amount")
	member["classes"] = []any{
		contributionClass("Fixed income", 10000, map[string]any{"account_id": "x"}),
	}
	f.h.ExpectToolError(
		f.h.Tool("save_contribution_plan", member),
		"invalid_arguments",
		"classes[0].members[0].account_id",
	)
}

// TestSaveContributionPlanToolS401 saves the member targets of S401 through the tool; the plan
// of 4000.00 then sends 1000.00 to PETR4 and nothing to BOVA11.
func TestSaveContributionPlanToolS401(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       "PETR4",
		"quote_instrument": "BRL",
		"date":             "2026-10-30",
		"value":            "40.00",
	}, http.StatusCreated, nil)

	args := f.plan(0)
	delete(args, "amount")
	args["classes"].([]any)[1] = contributionClass(
		"Domestic stocks",
		2000,
		instrumentMember("BOVA11", 5000),
		instrumentMember("PETR4", 5000),
	)

	var saved struct {
		Status string `json:"status"`
	}
	toolOutput(t, f.h, "save_contribution_plan", args, &saved)

	var out struct {
		Contribution struct {
			Classes []struct {
				Members []struct {
					Instrument string     `json:"instrument"`
					Amount     tool.Money `json:"amount"`
				} `json:"members"`
			} `json:"classes"`
		} `json:"contribution"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{
		"view": "contribution", "amount": "4000.00",
	}, &out)

	members := out.Contribution.Classes[1].Members
	if len(members) != 2 || members[0].Instrument != "BOVA11" || members[0].Amount.Amount != "0.00" ||
		members[1].Instrument != "PETR4" ||
		members[1].Amount.Amount != "1000.00" {
		t.Fatalf("members = %+v", members)
	}
}
