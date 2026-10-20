package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func (c cardSetup) statementID(t *testing.T, ref string) string {
	t.Helper()
	return statements(t, c.h, c.card)[ref].ID
}

func (c cardSetup) payStatement(t *testing.T, ref, date string, amount int64) apitest.Response {
	t.Helper()
	return c.h.Do(http.MethodPost, "/api/v1/statements/"+c.statementID(t, ref)+"/payments",
		map[string]any{"date": date, "from_account_id": c.checking, "amount": apitest.BRL(amount)})
}

func TestStatementPaymentEndpoint(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)

	r := c.payStatement(t, "2026-11", "2026-11-10", 150000)
	if r.Status != http.StatusCreated {
		t.Fatalf("payment status %d: %s", r.Status, r.Body)
	}
	var tx apitest.TransactionView
	r.Decode(t, &tx)
	card := cardPostings(tx, c.card)[0]
	// A89: made after the closing of 2026-11, the payment is billed on 2026-12 and settles 2026-11.
	if card.CardRole != "payment" || card.Statement != "2026-12" || card.Amount.Amount != 150000 {
		t.Fatalf("payment posting = %+v", card)
	}
	if s := statements(t, c.h, c.card)["2026-11"]; s.Status != "paid" {
		t.Fatalf("status = %s", s.Status)
	}
}

func TestEarlyPaymentInTwoParts(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)
	c.purchase("2026-10-27", 1)
	c.h.MustDo(http.MethodPost, "/api/v1/statements/"+c.statementID(t, "2026-11")+"/payments",
		map[string]any{"date": "2026-10-28", "from_account_id": c.checking, "amount": apitest.BRL(30000)}, http.StatusCreated, nil)
	c.h.MustDo(http.MethodPost, "/api/v1/statements/"+c.statementID(t, "2026-11")+"/payments",
		map[string]any{"date": "2026-11-10", "from_account_id": c.checking, "amount": apitest.BRL(120001)}, http.StatusCreated, nil)
	if s := statements(t, c.h, c.card)["2026-11"]; s.Status != "paid" || s.Payments != 30000 || s.Early != 30000 || s.AmountDue != 120001 {
		t.Fatalf("statement = %+v", s)
	}
}

func TestRevolvingInterestCharge(t *testing.T) {
	c := newCardSetup(t, "2026-12-05")
	interest := c.h.Account("Card interest", "expense", "", nil)
	c.purchase("2026-10-14", 150000)
	c.payStatement(t, "2026-11", "2026-11-10", 100000)
	c.h.Record("2026-12-01", map[string]any{"account_id": c.card, "amount": apitest.BRL(-6250), "statement": "2026-12"}, apitest.Posting(interest, 6250))

	ss := statements(t, c.h, c.card)
	if s := ss["2026-11"]; s.Status != "overdue" || s.Unpaid != 50000 {
		t.Fatalf("2026-11 = %+v", s)
	}
	if s := ss["2026-12"]; s.Opening != 150000 || s.Charges != 6250 || s.Payments != 100000 || s.AmountDue != 56250 {
		t.Fatalf("2026-12 = %+v", s)
	}
}

func TestStatementFinancing(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 200000)

	var res purchaseResult
	c.h.MustDo(http.MethodPost, "/api/v1/statements/"+c.statementID(t, "2026-11")+"/financing",
		map[string]any{"date": "2026-11-12", "installment_count": 6, "installment_amount": apitest.BRL(36340)}, http.StatusCreated, &res)

	cards := cardPostings(res.Transaction, c.card)
	if len(cards) != 7 || cards[0].CardRole != "payment" || cards[0].Amount.Amount != 200000 || cards[0].Statement != "2026-12" {
		t.Fatalf("settlement posting = %+v", cards)
	}
	for k, p := range cards[1:] {
		if p.Amount.Amount != -36340 || p.Installment == nil || p.Installment.Number != k+1 {
			t.Fatalf("installment %d = %+v", k+1, p)
		}
	}
	if cards[1].Statement != "2026-12" || cards[6].Statement != "2027-05" {
		t.Fatalf("installments billed %s..%s, want 2026-12..2027-05", cards[1].Statement, cards[6].Statement)
	}
	var interest int64
	for _, p := range res.Transaction.Postings {
		if p.AccountID != c.card {
			interest += p.Amount.Amount
		}
	}
	if interest != 18040 {
		t.Fatalf("interest = %d, want 18040", interest)
	}
	if s := statements(t, c.h, c.card)["2026-11"]; s.Status != "financed" {
		t.Fatalf("status = %s, want financed", s.Status)
	}

	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/statements/"+c.statementID(t, "2026-11")+"/financing",
		map[string]any{"date": "2026-11-12", "installment_count": 6, "installment_amount": apitest.BRL(36340)}), http.StatusConflict, "statement_financed", "")
}

func TestFinancingOpenStatementIs409(t *testing.T) {
	c := newCardSetup(t, "2026-10-20")
	c.purchase("2026-10-14", 200000)
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/statements/"+c.statementID(t, "2026-11")+"/financing",
		map[string]any{"date": "2026-10-20", "installment_count": 6, "installment_amount": apitest.BRL(36340)}), http.StatusConflict, "statement_not_closed", "")
}
