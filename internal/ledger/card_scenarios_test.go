package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// Acceptance scenarios S05–S15 and the card part of S23 (docs/domain/06-scenarios.md).
// Itaú Visa closes on day 3, is due on day 10 and bills closing-day purchases on the next statement.

func systemAccount(t *testing.T, h *apitest.Harness, role string) string {
	t.Helper()
	var out struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts", nil, http.StatusOK, &out)
	for _, a := range out.Items {
		if a.SystemRole == role {
			return a.ID
		}
	}
	t.Fatalf("no system account %s", role)
	return ""
}

func TestCardScenarios(t *testing.T) {
	laptop := func(c cardSetup, electronics string) purchaseResult {
		return installmentPurchase(c.h.T(), c.h, map[string]any{
			"card_account_id": c.card, "date": "2026-10-20", "description": "Laptop",
			"splits": []map[string]any{{"account_id": electronics, "amount": apitest.BRL(100000)}}, "installment_count": 3,
		})
	}
	tv := func(c cardSetup, electronics string) purchaseResult {
		return installmentPurchase(c.h.T(), c.h, map[string]any{
			"card_account_id": c.card, "date": "2026-10-25", "description": "TV",
			"splits":            []map[string]any{{"account_id": electronics, "amount": apitest.BRL(200000)}},
			"installment_count": 10, "interest": apitest.BRL(22540),
		})
	}

	t.Run("S05", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-12")
		closingCard := c.h.Card("Closing card", 3, 10, "closing")
		health := c.h.Account("Health", "expense", "", nil)
		cases := []struct {
			card, date, want string
		}{{c.card, "2026-10-14", "2026-11"}, {c.card, "2026-11-03", "2026-12"}, {closingCard, "2026-11-03", "2026-11"}}
		for _, cs := range cases {
			id := c.h.Record(cs.date, apitest.Posting(cs.card, -6000), apitest.Posting(health, 6000))
			if got := c.h.Transaction(id).Postings[0].Statement; got != cs.want {
				t.Errorf("purchase on %s billed on %s, want %s", cs.date, got, cs.want)
			}
		}
	})

	t.Run("S06", func(t *testing.T) {
		c := newCardSetup(t, "2026-10-25")
		res := laptop(c, c.h.Account("Electronics", "expense", "", nil))
		got := cardPostings(res.Transaction, c.card)
		if got[0].Amount.Amount != -33334 || got[1].Statement != "2026-12" || got[2].Statement != "2027-01" {
			t.Fatalf("installments = %+v", got)
		}
		if s := statements(t, c.h, c.card)["2026-11"]; s.Charges != 33334 {
			t.Fatalf("statement 2026-11 charges = %d", s.Charges)
		}
	})

	t.Run("S07", func(t *testing.T) {
		c := newCardSetup(t, "2026-10-25")
		res := tv(c, c.h.Account("Electronics", "expense", "", nil))
		var card int64
		for _, p := range cardPostings(res.Transaction, c.card) {
			card += p.Amount.Amount
		}
		if card != -222540 {
			t.Fatalf("card postings sum = %d, want -222540", card)
		}
	})

	t.Run("S08", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-20")
		electronics := c.h.Account("Electronics", "expense", "", nil)
		market := c.purchase("2026-10-14", 23000)
		c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+market+"/refunds", map[string]any{"date": "2026-10-20", "amount": apitest.BRL(23000)}, http.StatusCreated, nil)
		l := laptop(c, electronics)
		c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+l.Transaction.ID+"/refunds", map[string]any{"date": "2026-11-15", "amount": apitest.BRL(5000)}, http.StatusCreated, nil)
		c.h.ExpectProblem(refund(c.h, l.Transaction.ID, "2026-11-16", 96000), http.StatusUnprocessableEntity, "validation_failed", "amount")
		if s := statements(t, c.h, c.card); s["2026-11"].Credits != 23000 || s["2026-12"].Credits != 5000 {
			t.Fatalf("credits 2026-11 %d, 2026-12 %d", s["2026-11"].Credits, s["2026-12"].Credits)
		}
	})

	t.Run("S09", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-12")
		c.h.Record("2026-11-01", apitest.Posting(c.card, -4000), apitest.Posting(systemAccount(t, c.h, "fees"), 4000))
		if s := statements(t, c.h, c.card)["2026-11"]; s.Charges != 4000 {
			t.Fatalf("annual fee on 2026-11: charges %d", s.Charges)
		}
	})

	t.Run("S10", func(t *testing.T) {
		c := newCardSetup(t, "2026-12-05")
		c.purchase("2026-10-14", 150000)
		c.payStatement(t, "2026-11", "2026-11-10", 100000)
		c.h.Record("2026-12-01", map[string]any{"account_id": c.card, "amount": apitest.BRL(-6250), "statement": "2026-12"},
			apitest.Posting(systemAccount(t, c.h, "interest"), 6250))
		ss := statements(t, c.h, c.card)
		if ss["2026-11"].Status != "overdue" || ss["2026-12"].AmountDue != 56250 {
			t.Fatalf("2026-11 %+v, 2026-12 %+v", ss["2026-11"], ss["2026-12"])
		}
	})

	t.Run("S11", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-12")
		c.purchase("2026-10-14", 200000)
		c.h.MustDo(http.MethodPost, "/api/v1/statements/"+c.statementID(t, "2026-11")+"/financing",
			map[string]any{"date": "2026-11-12", "installment_count": 6, "installment_amount": apitest.BRL(36340)}, http.StatusCreated, nil)
		ss := statements(t, c.h, c.card)
		if ss["2026-11"].Status != "financed" || ss["2026-12"].Charges != 36340 || ss["2027-05"].Charges != 36340 {
			t.Fatalf("2026-11 %s, 2026-12 %d, 2027-05 %d", ss["2026-11"].Status, ss["2026-12"].Charges, ss["2027-05"].Charges)
		}
	})

	t.Run("S12", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-12")
		cashback := c.h.Account("Cashback", "income", "", nil)
		id := c.h.Record("2026-11-20", apitest.Posting(c.card, 1230), apitest.Posting(cashback, -1230))
		if p := c.h.Transaction(id).Postings[0]; p.CardRole != "credit" || p.Statement != "2026-12" {
			t.Fatalf("cashback posting = %+v", p)
		}
	})

	t.Run("S13", func(t *testing.T) {
		c := newCardSetup(t, "2026-12-05")
		charge := c.purchase("2026-10-14", 19990)
		d := openDispute(t, c.h, charge)
		c.h.MustDo(http.MethodPost, "/api/v1/disputes/"+d.ID+"/resolve",
			map[string]any{"resolved_on": "2026-12-02", "outcome": "won", "statement": "2026-12"}, http.StatusOK, nil)
		if s := statements(t, c.h, c.card)["2026-12"]; s.Credits != 19990 {
			t.Fatalf("2026-12 credits = %d", s.Credits)
		}
	})

	t.Run("S14", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-20")
		l := laptop(c, c.h.Account("Electronics", "expense", "", nil))
		c.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+l.PlanID+"/cancellation", map[string]any{"date": "2026-11-20"}, http.StatusCreated, nil)
		ss := statements(t, c.h, c.card)
		if ss["2026-12"].Charges-ss["2026-12"].Credits != -33334 || ss["2027-01"].Charges-ss["2027-01"].Credits != 0 {
			t.Fatalf("nets 2026-12 %d, 2027-01 %d", ss["2026-12"].Charges-ss["2026-12"].Credits, ss["2027-01"].Charges-ss["2027-01"].Credits)
		}
	})

	t.Run("S15", func(t *testing.T) {
		c := newCardSetup(t, "2027-01-15")
		res := tv(c, c.h.Account("Electronics", "expense", "", nil))
		c.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+res.PlanID+"/anticipation", map[string]any{
			"date": "2027-01-15", "from_installment": 5, "to_installment": 10, "target_statement": "2027-02", "amount": apitest.BRL(126000),
		}, http.StatusCreated, nil)
		ss := statements(t, c.h, c.card)
		if ss["2027-02"].Charges != 22254+126000 || ss["2027-05"].Charges-ss["2027-05"].Credits != 0 {
			t.Fatalf("2027-02 charges %d, 2027-05 net %d", ss["2027-02"].Charges, ss["2027-05"].Charges-ss["2027-05"].Credits)
		}
	})

	t.Run("S23", func(t *testing.T) {
		c := newCardSetup(t, "2026-01-01")
		opening := systemAccount(t, c.h, "opening_balances")
		c.h.Record("2026-01-01",
			cardPosting(c.card, -110000, "2026-01", ""), cardPosting(c.card, -40000, "2026-02", ""),
			cardPosting(c.card, -40000, "2026-03", ""), cardPosting(c.card, -40000, "2026-04", ""),
			apitest.Posting(opening, 230000))
		ss := statements(t, c.h, c.card)
		if ss["2026-01"].Charges != 110000 || ss["2026-04"].Charges != 40000 {
			t.Fatalf("opening statements = %+v", ss)
		}
	})
}
