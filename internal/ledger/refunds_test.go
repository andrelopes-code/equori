package ledger_test

import (
	"net/http"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func refund(h *apitest.Harness, id, date string, amount int64) apitest.Response {
	return h.Do(http.MethodPost, "/api/v1/transactions/"+id+"/refunds", map[string]any{"date": date, "amount": apitest.BRL(amount)})
}

func amountsByAccount(v apitest.TransactionView) map[string]int64 {
	m := map[string]int64{}
	for _, p := range v.Postings {
		m[p.AccountID] += p.Amount.Amount
	}
	return m
}

func TestRefunds(t *testing.T) {
	c := newCardSetup(t, "2026-11-20")
	electronics := c.h.Account("Electronics", "expense", "", nil)
	supermarket := c.purchase("2026-10-14", 23000)

	r := refund(c.h, supermarket, "2026-10-20", 23000)
	if r.Status != http.StatusCreated {
		t.Fatalf("refund status %d: %s", r.Status, r.Body)
	}
	var full apitest.TransactionView
	r.Decode(t, &full)
	if card := cardPostings(full, c.card)[0]; card.Amount.Amount != 23000 || card.CardRole != "credit" || card.Statement != "2026-11" {
		t.Fatalf("refund card posting = %+v", card)
	}
	if amountsByAccount(full)[c.food] != -23000 {
		t.Fatalf("refund category = %v", amountsByAccount(full))
	}

	laptop := installmentPurchase(t, c.h, map[string]any{
		"card_account_id": c.card, "date": "2026-10-20",
		"splits": []map[string]any{{"account_id": electronics, "amount": apitest.BRL(100000)}}, "installment_count": 3,
	})
	var partial apitest.TransactionView
	r = refund(c.h, laptop.Transaction.ID, "2026-11-15", 5000)
	r.Decode(t, &partial)
	if card := cardPostings(partial, c.card)[0]; card.Statement != "2026-12" || amountsByAccount(partial)[electronics] != -5000 {
		t.Fatalf("partial refund = %+v", partial)
	}
	c.h.ExpectProblem(refund(c.h, laptop.Transaction.ID, "2026-11-16", 96000), http.StatusUnprocessableEntity, "validation_failed", "amount")
}

func TestRefundIsProportional(t *testing.T) {
	c := newCardSetup(t, "2026-11-20")
	cleaning := c.h.Account("Cleaning", "expense", "", nil)
	id := c.h.Record("2026-10-14", apitest.Posting(c.card, -23000), apitest.Posting(c.food, 18000), apitest.Posting(cleaning, 5000))

	var v apitest.TransactionView
	r := refund(c.h, id, "2026-10-20", 10000)
	r.Decode(t, &v)
	got := amountsByAccount(v)
	if got[c.food] != -7827 || got[cleaning] != -2173 {
		t.Fatalf("refund split = food %d cleaning %d, want -7827 and -2173", got[c.food], got[cleaning])
	}
}

func TestConcurrentRefundsRespectCeiling(t *testing.T) {
	c := newCardSetup(t, "2026-11-20")
	id := c.purchase("2026-10-14", 100000)

	var wg sync.WaitGroup
	statuses := make([]int, 2)
	for i := range 2 {
		wg.Go(func() { statuses[i] = refund(c.h, id, "2026-10-20", 60000).Status })
	}
	wg.Wait()

	created := 0
	for _, s := range statuses {
		if s == http.StatusCreated {
			created++
		} else if s != http.StatusUnprocessableEntity {
			t.Fatalf("unexpected status %d", s)
		}
	}
	if created != 1 {
		t.Fatalf("statuses = %v, want exactly one refund", statuses)
	}
}

func TestInstallmentCancellation(t *testing.T) {
	c := newCardSetup(t, "2026-11-20")
	electronics := c.h.Account("Electronics", "expense", "", nil)
	laptop := installmentPurchase(t, c.h, map[string]any{
		"card_account_id": c.card, "date": "2026-10-20",
		"splits": []map[string]any{{"account_id": electronics, "amount": apitest.BRL(100000)}}, "installment_count": 3,
	})

	var v apitest.TransactionView
	c.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+laptop.PlanID+"/cancellation", map[string]any{"date": "2026-11-20"}, http.StatusCreated, &v)

	byStatement := map[string]int64{}
	for _, p := range cardPostings(v, c.card) {
		if p.CardRole != "credit" {
			t.Fatalf("cancellation card posting role %q", p.CardRole)
		}
		byStatement[p.Statement] += p.Amount.Amount
	}
	if byStatement["2026-12"] != 66667 || byStatement["2027-01"] != 33333 || amountsByAccount(v)[electronics] != -100000 {
		t.Fatalf("cancellation = %v, electronics %d", byStatement, amountsByAccount(v)[electronics])
	}
	ss := statements(t, c.h, c.card)
	if s := ss["2026-12"]; s.Charges-s.Credits != -33334 {
		t.Fatalf("2026-12 net = %d, want -33334 (credit)", s.Charges-s.Credits)
	}
	if s := ss["2027-01"]; s.Charges-s.Credits != 0 {
		t.Fatalf("2027-01 net = %d, want 0", s.Charges-s.Credits)
	}
}

func TestInstallmentAnticipation(t *testing.T) {
	c := newCardSetup(t, "2027-01-15")
	electronics := c.h.Account("Electronics", "expense", "", nil)
	tv := installmentPurchase(t, c.h, map[string]any{
		"card_account_id": c.card, "date": "2026-10-25",
		"splits":            []map[string]any{{"account_id": electronics, "amount": apitest.BRL(200000)}},
		"installment_count": 10, "interest": apitest.BRL(22540),
	})

	var v apitest.TransactionView
	c.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+tv.PlanID+"/anticipation", map[string]any{
		"date": "2027-01-15", "from_installment": 5, "to_installment": 10, "target_statement": "2027-02", "amount": apitest.BRL(126000),
	}, http.StatusCreated, &v)

	byStatement := map[string]int64{}
	for _, p := range cardPostings(v, c.card) {
		byStatement[p.Statement] += p.Amount.Amount
	}
	if byStatement["2027-02"] != -126000 || byStatement["2027-03"] != 22254 || byStatement["2027-08"] != 22254 || len(byStatement) != 7 {
		t.Fatalf("anticipation = %v", byStatement)
	}
	var discount int64
	for acc, amount := range amountsByAccount(v) {
		if acc != c.card {
			discount += amount
		}
	}
	if discount != -7524 {
		t.Fatalf("discount = %d, want -7524", discount)
	}
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/installment-plans/"+tv.PlanID+"/anticipation", map[string]any{
		"date": "2027-01-15", "from_installment": 4, "to_installment": 4, "target_statement": "2027-02", "amount": apitest.BRL(30000),
	}), http.StatusUnprocessableEntity, "validation_failed", "amount")
}
