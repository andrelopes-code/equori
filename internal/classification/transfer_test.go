package classification_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type cardBooks struct {
	books
	card string
}

// newCardBooks adds Itaú Visa with statement 2026-11 closed on 1,500.00 of charges.
func newCardBooks(t *testing.T) cardBooks {
	b := cardBooks{books: newBooks(t)}
	b.card = b.h.Card("Itaú Visa", 3, 10, "next")
	b.h.Record("2026-10-14", apitest.Posting(b.card, -150000), apitest.Posting(b.food, 150000))
	return b
}

func (b cardBooks) importCard(t *testing.T, lines ...apitest.OFXLine) {
	t.Helper()
	if r := b.h.Import(b.card, "ofx", "fatura.ofx", apitest.CardOFX(lines...)); r.Status != http.StatusCreated {
		t.Fatalf("card import status %d: %s", r.Status, r.Body)
	}
}

func (b cardBooks) transactions(t *testing.T) []apitest.TransactionView {
	t.Helper()
	var out struct {
		Items []apitest.TransactionView `json:"items"`
	}
	b.h.MustDo(http.MethodGet, "/api/v1/transactions?account_id="+b.card+"&from=2026-11-01", nil, http.StatusOK, &out)
	return out.Items
}

// S45 through a rule: checking file first, then the card file matches.
func TestRuleTransfersCardPayment(t *testing.T) {
	b := newCardBooks(t)
	createRule(t, b.h, "Fatura", []map[string]any{contains("pagamento fatura")}, []map[string]any{{"type": "transfer", "account_id": b.card}})
	b.importLines(t, "nubank.ofx", line("20261110", "-1500.00", "c1", "PAGAMENTO FATURA ITAU"))
	b.importCard(t, line("20261111", "1500.00", "p1", "PAGAMENTO RECEBIDO"))

	txs := b.transactions(t)
	if len(txs) != 1 || len(txs[0].Postings) != 2 {
		t.Fatalf("card transactions = %+v", txs)
	}
	for _, p := range txs[0].Postings {
		if p.AccountID == b.card && (p.CardRole != "payment" || p.Statement != "2026-12" || p.Amount.Amount != 150000) {
			t.Fatalf("card posting = %+v", p)
		}
	}
}

// S46 through a rule: card file first, then the checking line completes its transaction.
func TestRuleCompletesCardPayment(t *testing.T) {
	b := newCardBooks(t)
	b.importCard(t, line("20261111", "1500.00", "p1", "PAGAMENTO RECEBIDO"))
	createRule(t, b.h, "Fatura", []map[string]any{contains("pagamento fatura")}, []map[string]any{{"type": "transfer", "account_id": b.card}})
	b.importLines(t, "nubank.ofx", line("20261110", "-1500.00", "c1", "PAGAMENTO FATURA ITAU"))

	txs := b.transactions(t)
	if len(txs) != 1 || txs[0].Version != 2 {
		t.Fatalf("card transactions = %+v", txs)
	}
	got := map[string]int64{}
	for _, p := range txs[0].Postings {
		got[p.AccountID] = p.Amount.Amount
	}
	if len(got) != 2 || got[b.checking] != -150000 || got[b.card] != 150000 {
		t.Fatalf("postings = %v", got)
	}
}

// Running rules pairs two uncategorized imported sides.
func TestRunRulesPairsImportedSides(t *testing.T) {
	b := newCardBooks(t)
	b.importLines(t, "nubank.ofx", line("20261110", "-1500.00", "c1", "PAGAMENTO FATURA ITAU"))
	b.importCard(t, line("20261111", "1500.00", "p1", "PAGAMENTO RECEBIDO"))
	dispatch(t, b.h)
	createRule(t, b.h, "Fatura", []map[string]any{contains("pagamento fatura")}, []map[string]any{{"type": "transfer", "account_id": b.card}})

	var run struct {
		Examined    int `json:"examined"`
		Categorized int `json:"categorized"`
	}
	b.h.MustDo(http.MethodPost, "/api/v1/rules/run", nil, http.StatusOK, &run)
	if run.Examined != 2 || run.Categorized != 1 {
		t.Fatalf("run = %+v", run)
	}
	var live []apitest.TransactionView
	for _, tx := range b.transactions(t) {
		var full struct {
			VoidedAt *string `json:"voided_at"`
		}
		b.h.MustDo(http.MethodGet, "/api/v1/transactions/"+tx.ID, nil, http.StatusOK, &full)
		if full.VoidedAt == nil {
			live = append(live, tx)
		}
	}
	if len(live) != 1 || len(live[0].Postings) != 2 {
		t.Fatalf("live card transactions = %+v", live)
	}
}

// S49: a reimbursable expense goes to the counterparty's receivable (S18 step 1).
func TestRuleMarksReimbursable(t *testing.T) {
	b := newCardBooks(t)
	employer := b.h.Account("Receivable Employer", "asset", "receivable", nil)
	createRule(t, b.h, "Hotel", []map[string]any{contains("hotel")}, []map[string]any{{"type": "mark_reimbursable", "account_id": employer}})
	b.importCard(t, line("20261105", "-800.00", "h1", "HOTEL IBIS"))

	txs := b.transactions(t)
	if len(txs) != 1 {
		t.Fatalf("card transactions = %+v", txs)
	}
	got := map[string]string{}
	for _, p := range txs[0].Postings {
		got[p.AccountID] = p.CardRole
		if p.AccountID == employer && p.Amount.Amount != 80000 {
			t.Fatalf("receivable posting = %+v", p)
		}
	}
	if len(got) != 2 || got[b.card] != "charge" {
		t.Fatalf("postings = %+v", txs[0].Postings)
	}
}

// P5b Review Focus 5 for rules.
func TestTransferActionRejections(t *testing.T) {
	b := newCardBooks(t)
	for _, tt := range []struct {
		name    string
		actions []map[string]any
		field   string
	}{
		{"transfer to a category", []map[string]any{{"type": "transfer", "account_id": b.food}}, "actions[0].account_id"},
		{"reimbursable to checking", []map[string]any{{"type": "mark_reimbursable", "account_id": b.checking}}, "actions[0].account_id"},
		{"transfer without account", []map[string]any{{"type": "transfer"}}, "actions[0].account_id"},
		{"transfer and category", []map[string]any{setCategory(b.food), {"type": "transfer", "account_id": b.card}}, "actions[1].type"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			b.h.ExpectProblem(b.h.Do(http.MethodPost, "/api/v1/rules", map[string]any{"name": "r", "conditions": []any{contains("x")}, "actions": tt.actions}),
				http.StatusUnprocessableEntity, "validation_failed", tt.field)
		})
	}
}
