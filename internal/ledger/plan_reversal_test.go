package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// Scenarios S172–S174 (A135): a plan reverses each installment once, whether a cancellation or
// an anticipation reversed it first.

// anticipatedTV is the TV of S07 with installments 5/10 to 10/10 anticipated to 2027-02 for
// 1,260.00 on 2027-01-15 (S15).
func anticipatedTV(t *testing.T, today string) (c cardSetup, planID string) {
	t.Helper()
	c = newCardSetup(t, today)
	res := installmentPurchase(t, c.h, map[string]any{
		"card_account_id": c.card, "date": "2026-10-25", "description": "TV",
		"splits":            []map[string]any{{"account_id": c.h.Account("Electronics", "expense", "", nil), "amount": apitest.BRL(200000)}},
		"installment_count": 10, "interest": apitest.BRL(22540),
	})
	c.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+res.PlanID+"/anticipation", map[string]any{
		"date": "2027-01-15", "from_installment": 5, "to_installment": 10, "target_statement": "2027-02", "amount": apitest.BRL(126000),
	}, http.StatusCreated, nil)
	return c, res.PlanID
}

// cancelPlan cancels the plan on date and returns the cancellation.
func cancelPlan(t *testing.T, c cardSetup, planID, date string) apitest.TransactionView {
	t.Helper()
	var out apitest.TransactionView
	c.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+planID+"/cancellation", map[string]any{"date": date}, http.StatusCreated, &out)
	return out
}

// checkCancellationBalances asserts the categories lose the charged 2,225.40 and the discount
// of the anticipation comes back.
func checkCancellationBalances(t *testing.T, c cardSetup, v apitest.TransactionView) {
	t.Helper()
	discounts := systemAccount(t, c.h, "discounts")
	var categories, discount int64
	for _, p := range v.Postings {
		switch p.AccountID {
		case c.card:
		case discounts:
			discount += p.Amount.Amount
		default:
			categories += p.Amount.Amount
		}
	}
	if categories != -222540 || discount != 7524 {
		t.Fatalf("categories %d, discount %d, want -222540 and 7524", categories, discount)
	}
}

func net(s statementView) int64 { return int64(s.Charges - s.Credits) }

// S172: cancelled before the anticipation's statement closes, the plan reverses installment 4/10
// and the anticipation's charge on 2027-02 and credits the billed 1/10 to 3/10; installments
// 5/10 to 10/10 stay reversed once.
func TestS172CancellationAfterAnticipationBeforeItsClosing(t *testing.T) {
	t.Parallel()
	c, planID := anticipatedTV(t, "2027-01-20")
	v := cancelPlan(t, c, planID, "2027-01-20")
	checkCancellationBalances(t, c, v)
	ss := statements(t, c.h, c.card)
	if net(ss["2027-02"]) != -3*22254 {
		t.Errorf("2027-02 net = %d, want %d", net(ss["2027-02"]), -3*22254)
	}
	for _, ref := range []string{"2027-03", "2027-05", "2027-08"} {
		if net(ss[ref]) != 0 {
			t.Errorf("%s net = %d, want 0", ref, net(ss[ref]))
		}
	}
}

// S173: cancelled after the anticipation's statement closed, the plan credits the billed 1/10
// to 4/10 and the anticipation's 1,260.00 on 2027-03.
func TestS173CancellationAfterAnticipationBilled(t *testing.T) {
	t.Parallel()
	c, planID := anticipatedTV(t, "2027-02-20")
	v := cancelPlan(t, c, planID, "2027-02-20")
	checkCancellationBalances(t, c, v)
	ss := statements(t, c.h, c.card)
	if net(ss["2027-03"]) != -(4*22254 + 126000) {
		t.Errorf("2027-03 net = %d, want %d", net(ss["2027-03"]), -(4*22254 + 126000))
	}
	if net(ss["2027-02"]) != 22254+126000 {
		t.Errorf("2027-02 net = %d, want %d", net(ss["2027-02"]), 22254+126000)
	}
	for _, ref := range []string{"2027-05", "2027-08"} {
		if net(ss[ref]) != 0 {
			t.Errorf("%s net = %d, want 0", ref, net(ss[ref]))
		}
	}
}

// S174: an installment already anticipated, or a cancelled plan, is not anticipated again.
func TestS174AnticipationOfReversedInstallments(t *testing.T) {
	t.Parallel()
	c, planID := anticipatedTV(t, "2027-01-20")
	again := func() apitest.Response {
		return c.h.Do(http.MethodPost, "/api/v1/installment-plans/"+planID+"/anticipation", map[string]any{
			"date": "2027-01-20", "from_installment": 4, "to_installment": 6, "target_statement": "2027-02", "amount": apitest.BRL(60000),
		})
	}
	c.h.ExpectProblem(again(), http.StatusUnprocessableEntity, "validation_failed", "from_installment")
	cancelPlan(t, c, planID, "2027-01-20")
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/installment-plans/"+planID+"/anticipation", map[string]any{
		"date": "2027-01-20", "from_installment": 4, "to_installment": 4, "target_statement": "2027-02", "amount": apitest.BRL(22254),
	}), http.StatusUnprocessableEntity, "validation_failed", "from_installment")
}
