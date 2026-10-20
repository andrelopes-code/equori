package ledger_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type installmentView struct {
	Number    int    `json:"number"`
	Statement string `json:"statement"`
	Amount    struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Reversed bool `json:"reversed"`
}

type planView struct {
	ID            string `json:"id"`
	TransactionID string `json:"transaction_id"`
	AccountID     string `json:"account_id"`
	Status        string `json:"status"`
	Count         int    `json:"count"`
	Interest      *struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	} `json:"interest"`
	Installments []installmentView `json:"installments"`
}

func getPlan(t *testing.T, h *apitest.Harness, id string) planView {
	t.Helper()
	var p planView
	h.MustDo(http.MethodGet, "/api/v1/installment-plans/"+id, nil, http.StatusOK, &p)
	return p
}

// row is the comparable projection of an installment: number, statement, amount, reversed.
type installmentRow struct {
	Number    int
	Statement string
	Amount    int64
	Reversed  bool
}

func rowsOf(p planView) []installmentRow {
	out := make([]installmentRow, len(p.Installments))
	for i, in := range p.Installments {
		out[i] = installmentRow{in.Number, in.Statement, in.Amount.Amount, in.Reversed}
	}
	return out
}

func TestInstallmentPlanView(t *testing.T) {
	t.Parallel()
	laptopBody := func(c cardSetup, electronics string) map[string]any {
		return map[string]any{
			"card_account_id": c.card, "date": "2026-10-20",
			"splits": []map[string]any{{"account_id": electronics, "amount": apitest.BRL(100000)}}, "installment_count": 3,
		}
	}

	t.Run("S06 schedule", func(t *testing.T) {
		c := newCardSetup(t, "2026-10-20")
		laptop := installmentPurchase(t, c.h, laptopBody(c, c.h.Account("Electronics", "expense", "", nil)))

		p := getPlan(t, c.h, laptop.PlanID)
		if p.ID != laptop.PlanID || p.TransactionID != laptop.Transaction.ID || p.AccountID != c.card {
			t.Fatalf("plan identity = %+v, want id %s transaction %s account %s", p, laptop.PlanID, laptop.Transaction.ID, c.card)
		}
		if p.Status != "active" || p.Count != 3 || p.Interest != nil {
			t.Fatalf("plan = status %q count %d interest %+v, want active, 3, none", p.Status, p.Count, p.Interest)
		}
		want := []installmentRow{{1, "2026-11", 33334, false}, {2, "2026-12", 33333, false}, {3, "2027-01", 33333, false}}
		if got := rowsOf(p); !reflect.DeepEqual(got, want) {
			t.Fatalf("installments = %+v, want %+v", got, want)
		}
		if cur := p.Installments[0].Amount.Currency; cur != "BRL" {
			t.Fatalf("installment currency = %q, want BRL", cur)
		}
	})

	t.Run("S07 interest", func(t *testing.T) {
		c := newCardSetup(t, "2026-10-25")
		tv := installmentPurchase(t, c.h, map[string]any{
			"card_account_id": c.card, "date": "2026-10-25", "description": "TV",
			"splits":            []map[string]any{{"account_id": c.h.Account("Electronics", "expense", "", nil), "amount": apitest.BRL(200000)}},
			"installment_count": 10, "interest": apitest.BRL(22540),
		})

		p := getPlan(t, c.h, tv.PlanID)
		if p.Interest == nil || p.Interest.Amount != 22540 || p.Interest.Currency != "BRL" {
			t.Fatalf("interest = %+v, want 22540 BRL", p.Interest)
		}
		if len(p.Installments) != 10 {
			t.Fatalf("installments = %d, want 10", len(p.Installments))
		}
		for i, in := range p.Installments {
			if in.Number != i+1 || in.Amount.Amount != 22254 || in.Reversed {
				t.Fatalf("installment %d = %+v, want number %d amount 22254 not reversed", i, in, i+1)
			}
		}
	})

	t.Run("S14 cancelled", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-20")
		laptop := installmentPurchase(t, c.h, laptopBody(c, c.h.Account("Electronics", "expense", "", nil)))
		c.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+laptop.PlanID+"/cancellation", map[string]any{"date": "2026-11-20"}, http.StatusCreated, nil)

		p := getPlan(t, c.h, laptop.PlanID)
		want := []installmentRow{{1, "2026-11", 33334, true}, {2, "2026-12", 33333, true}, {3, "2027-01", 33333, true}}
		if p.Status != "cancelled" || !reflect.DeepEqual(rowsOf(p), want) {
			t.Fatalf("plan = status %q installments %+v, want cancelled %+v", p.Status, rowsOf(p), want)
		}
	})

	t.Run("S15 anticipated", func(t *testing.T) {
		c := newCardSetup(t, "2027-01-15")
		tv := installmentPurchase(t, c.h, map[string]any{
			"card_account_id": c.card, "date": "2026-10-25",
			"splits":            []map[string]any{{"account_id": c.h.Account("Electronics", "expense", "", nil), "amount": apitest.BRL(200000)}},
			"installment_count": 10, "interest": apitest.BRL(22540),
		})
		c.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+tv.PlanID+"/anticipation", map[string]any{
			"date": "2027-01-15", "from_installment": 5, "to_installment": 10, "target_statement": "2027-02", "amount": apitest.BRL(126000),
		}, http.StatusCreated, nil)

		p := getPlan(t, c.h, tv.PlanID)
		if p.Status != "anticipated" {
			t.Fatalf("status = %q, want anticipated", p.Status)
		}
		if len(p.Installments) != 10 {
			t.Fatalf("installments = %d, want 10", len(p.Installments))
		}
		for _, in := range p.Installments {
			if want := in.Number >= 5; in.Reversed != want {
				t.Fatalf("installment %d reversed = %v, want %v", in.Number, in.Reversed, want)
			}
		}
	})

	t.Run("voided cancellation", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-20")
		laptop := installmentPurchase(t, c.h, laptopBody(c, c.h.Account("Electronics", "expense", "", nil)))
		var cancellation apitest.TransactionView
		c.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+laptop.PlanID+"/cancellation", map[string]any{"date": "2026-11-20"}, http.StatusCreated, &cancellation)
		c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+cancellation.ID+"/void", map[string]string{"reason": "mistake"}, http.StatusOK, nil)

		p := getPlan(t, c.h, laptop.PlanID)
		want := []installmentRow{{1, "2026-11", 33334, false}, {2, "2026-12", 33333, false}, {3, "2027-01", 33333, false}}
		if p.Status != "active" || !reflect.DeepEqual(rowsOf(p), want) {
			t.Fatalf("plan = status %q installments %+v, want active %+v", p.Status, rowsOf(p), want)
		}
	})

	t.Run("other user and unknown id", func(t *testing.T) {
		c := newCardSetup(t, "2026-10-20")
		laptop := installmentPurchase(t, c.h, laptopBody(c, c.h.Account("Electronics", "expense", "", nil)))

		other := c.h.Login("other@example.com")
		c.h.ExpectProblem(c.h.Call(other, http.MethodGet, "/api/v1/installment-plans/"+laptop.PlanID, nil), http.StatusNotFound, "not_found", "")
		c.h.ExpectProblem(c.h.Do(http.MethodGet, "/api/v1/installment-plans/00000000-0000-4000-8000-000000000000", nil), http.StatusNotFound, "not_found", "")
	})
}
