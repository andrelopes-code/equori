package ingestion_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func typedCardLine(id, date string, amount pluggy.Decimal, operation string) pluggy.Transaction {
	t := cardLine(id, date, amount, "POSTED", new("bill-nov"))
	t.OperationType = new(operation)
	return t
}

// counterRole is the system role of the account on the other side of the card posting.
func (f syncFixture) counterRole(tx, card string) string {
	f.h.T().Helper()
	for _, p := range f.h.Transaction(tx).Postings {
		if p.AccountID == card {
			continue
		}
		var role *string
		if err := f.h.Pool.QueryRow(f.h.T().Context(), `SELECT system_role FROM ledger_account WHERE id = $1`, p.AccountID).Scan(&role); err != nil {
			f.h.T().Fatal(err)
		}
		if role == nil {
			return ""
		}
		return *role
	}
	f.h.T().Fatalf("transaction %s has no other posting", tx)
	return ""
}

func newCardSync(t *testing.T) (syncFixture, string) {
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapTo(pluggy.SubtypeCard, card)
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-nov", DueDate: "2026-11-10T00:00:00.000Z", TotalAmount: "0"})
	return f, card
}

// S83: a card line typed as a bill payment is a payment against transfers_in_transit; a
// refund stays a credit (A88).
func TestS83PaymentLineFromAggregator(t *testing.T) {
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, typedCardLine("pay-1", "2026-10-05", "-961.85", "PAGAMENTO_FATURA"))
	f.line(pluggy.SubtypeCard, typedCardLine("ref-1", "2026-10-06", "-72.90", "ESTORNO"))
	f.sync()

	_, pay := f.recordOf("pay-1")
	if p := f.cardPosting(pay, card); p.CardRole != "payment" || p.Amount.Amount != 96185 {
		t.Fatalf("payment posting = %+v", p)
	}
	if role := f.counterRole(pay, card); role != "transfers_in_transit" {
		t.Fatalf("payment counterpart role = %q", role)
	}
	_, refund := f.recordOf("ref-1")
	if p := f.cardPosting(refund, card); p.CardRole != "credit" || p.Amount.Amount != 7290 {
		t.Fatalf("refund posting = %+v", p)
	}
	if role := f.counterRole(refund, card); role != "uncategorized_income" {
		t.Fatalf("refund counterpart role = %q", role)
	}
}

// A88: a payment recorded before its type was read becomes a payment on the next sync.
func TestSyncRetypesARecordedPayment(t *testing.T) {
	f, card := newCardSync(t)
	untyped := cardLine("pay-1", "2026-11-05", "-961.85", "POSTED", new("bill-nov"))
	f.line(pluggy.SubtypeCard, untyped)
	f.sync()
	_, tx := f.recordOf("pay-1")
	if p := f.cardPosting(tx, card); p.CardRole != "credit" {
		t.Fatalf("untyped posting = %+v", p)
	}

	f.line(pluggy.SubtypeCard, typedCardLine("pay-1", "2026-11-05", "-961.85", "PAGAMENTO_FATURA"))
	f.sync()
	v := f.h.Transaction(tx)
	if p := f.cardPosting(tx, card); v.Version != 2 || p.CardRole != "payment" || p.Amount.Amount != 96185 {
		t.Fatalf("retyped transaction v%d, posting = %+v", v.Version, p)
	}
	if role := f.counterRole(tx, card); role != "transfers_in_transit" {
		t.Fatalf("retyped counterpart role = %q", role)
	}
	if b := f.batches(card)[0]; b.Counts.Updated != 1 {
		t.Fatalf("batch = %+v", b)
	}
}

// Plan Review Focus 1: a payment the owner categorized before its type was read keeps its
// categorization; the record reports the change it did not take.
func TestSyncKeepsACategorizedPayment(t *testing.T) {
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, cardLine("pay-1", "2026-11-05", "-961.85", "POSTED", new("bill-nov")))
	f.sync()
	_, tx := f.recordOf("pay-1")
	gifts := f.h.Account("Gifts", "income", "", nil)
	f.h.MustDo(http.MethodPost, "/api/v1/transactions/"+tx+"/categorize", map[string]any{
		"expected_version": 1, "parts": []map[string]any{{"account_id": gifts, "amount": apitest.BRL(-96185)}},
	}, http.StatusOK, nil)

	f.line(pluggy.SubtypeCard, typedCardLine("pay-1", "2026-11-05", "-961.85", "PAGAMENTO_FATURA"))
	f.sync()
	if p := f.cardPosting(tx, card); f.h.Transaction(tx).Version != 2 || p.CardRole != "credit" {
		t.Fatalf("categorized payment changed: %+v", f.h.Transaction(tx))
	}
	var change *string
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT unapplied_change FROM ingestion_external_record WHERE external_id = 'pay-1'`).Scan(&change); err != nil {
		t.Fatal(err)
	}
	if change == nil || *change == "" {
		t.Fatal("no unapplied change on the record")
	}
	// The type stays unapplied, so a later sync offers it again.
	if n := f.count(`SELECT count(*) FROM ingestion_external_record WHERE external_id = 'pay-1' AND line_kind IS NULL`); n != 1 {
		t.Fatal("the refused type is recorded as applied")
	}
}

// S46 (A88): a card line typed as a payment comes first; the checking line pairs with it and
// replaces the transit posting.
func TestS46TypedPaymentPairsWithChecking(t *testing.T) {
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, typedCardLine("pay-1", "2026-11-10", "-1500.00", "PAGAMENTO_FATURA"))
	f.sync()
	_, cardTx := f.recordOf("pay-1")

	amount, err := money.New(-150000, "BRL")
	if err != nil {
		t.Fatal(err)
	}
	ids, err := f.h.App.Ledger.RecordImportedBatch(t.Context(), f.h.OwnerID(), []ledger.ImportedRecord{{
		RecordID: uuid.New(),
		Posting: ledger.ImportedPosting{AccountID: uuid.MustParse(f.checking), Date: time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC),
			Amount: amount, Description: "PAGAMENTO FATURA NUBANK"},
		Decision: &ledger.ImportDecision{TransferTo: uuid.MustParse(card)},
	}})
	if err != nil {
		t.Fatal(err)
	}
	v := f.h.Transaction(cardTx)
	if ids[0].String() != cardTx || v.Version != 2 || len(v.Postings) != 2 {
		t.Fatalf("paired %s into %s: %+v", ids[0], cardTx, v)
	}
	if got := postingAmounts(v); got[f.checking] != -150000 || got[card] != 150000 || f.cardPosting(cardTx, card).CardRole != "payment" {
		t.Fatalf("paired transaction = %+v", v)
	}
}

// S88 (A91): a pending line without a bill and the posted line of the same amount and sign
// within 3 days are one line; a pending and a posted charge five days apart are two.
func TestS88PendingPaymentSuperseded(t *testing.T) {
	f, card := newCardSync(t)
	pending := cardLine("pay-pending", "2026-11-05", "-784.65", "PENDING", nil)
	pending.OperationType = new("PAGAMENTO_FATURA")
	f.line(pluggy.SubtypeCard, pending)
	f.line(pluggy.SubtypeCard, typedCardLine("pay-posted", "2026-11-05", "-784.65", "PAGAMENTO_FATURA"))
	f.line(pluggy.SubtypeCard, cardLine("charge-pending", "2026-11-09", "50.00", "PENDING", nil))
	f.line(pluggy.SubtypeCard, cardLine("charge-posted", "2026-11-03", "50.00", "POSTED", new("bill-nov")))
	f.sync()

	payments := f.count(`SELECT count(*) FROM ledger_posting p JOIN ledger_transaction t ON t.id = p.transaction_id
		WHERE p.account_id = $1 AND p.amount = 78465 AND t.voided_at IS NULL`, card)
	charges := f.count(`SELECT count(*) FROM ledger_posting p JOIN ledger_transaction t ON t.id = p.transaction_id
		WHERE p.account_id = $1 AND p.amount = -5000 AND t.voided_at IS NULL`, card)
	if payments != 1 || charges != 2 {
		t.Fatalf("payments %d, charges %d; want 1 and 2", payments, charges)
	}
	if n := f.count(`SELECT count(*) FROM ingestion_external_record WHERE external_id = 'pay-pending' AND state <> 'withdrawn'`); n != 0 {
		t.Fatalf("pending payment records = %d", n)
	}
}

// A91: a pending line recorded by an earlier sync is withdrawn when its posted line arrives
// under another id, and the posted line confirms its transaction.
func TestSyncPendingLineSupersededLater(t *testing.T) {
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, cardLine("charge-pending", "2026-11-05", "50.00", "PENDING", nil))
	f.sync()
	_, tx := f.recordOf("charge-pending")

	f.line(pluggy.SubtypeCard, cardLine("charge-posted", "2026-11-06", "50.00", "POSTED", new("bill-nov")))
	f.sync()
	if state, _ := f.recordOf("charge-pending"); state != "withdrawn" {
		t.Fatalf("pending record = %s", state)
	}
	if state, matched := f.recordOf("charge-posted"); state != "matched" || matched != tx {
		t.Fatalf("posted record = %s on %s, want matched on %s", state, matched, tx)
	}
	if p := f.cardPosting(tx, card); p.Status != "cleared" {
		t.Fatalf("posting = %+v", p)
	}
}

// A89: a payment is billed on the statement of its date even when the source lists it on the
// bill it pays: Pluggy listed a payment of 2026-10-05 on the bill that closed on 2026-09-28.
func TestPaymentBilledByItsDateNotItsBill(t *testing.T) {
	f, card := newCardSync(t)
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-dec", DueDate: "2026-12-10T00:00:00.000Z", TotalAmount: "0"})
	paid := cardLine("pay-1", "2026-11-05", "-784.65", "POSTED", new("bill-nov"))
	paid.OperationType = new("PAGAMENTO_FATURA")
	f.line(pluggy.SubtypeCard, paid)
	f.sync()
	_, tx := f.recordOf("pay-1")
	if p := f.cardPosting(tx, card); p.CardRole != "payment" || p.Statement != "2026-12" {
		t.Fatalf("payment posting = %+v", p)
	}
}
