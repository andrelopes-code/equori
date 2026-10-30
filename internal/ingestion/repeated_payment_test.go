package ingestion_test

import (
	"testing"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

// S185 (A142): a card payment returned under a second id on another bill waits for review
// instead of paying the card twice; later syncs leave it there.
func TestS185RepeatedPaymentWaitsForReview(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-dec", DueDate: "2026-12-10T00:00:00.000Z", TotalAmount: "0"})
	f.line(pluggy.SubtypeCard, typedCardLine("pay-bill", "2026-11-05", "-784.65", "PAGAMENTO_FATURA"))
	f.sync()

	copied := typedCardLine("pay-copy", "2026-11-05", "-784.65", "PAGAMENTO_FATURA")
	copied.CreditCardMetadata.BillID = new("bill-dec")
	f.line(pluggy.SubtypeCard, copied)
	f.sync()

	f.assertRepeated(card, "pay-copy")
	if b := f.batches(card)[0]; b.Counts.NeedsReview != 1 || b.Counts.Created != 0 {
		t.Fatalf("batch counts = %+v", b.Counts)
	}

	f.sync()

	f.assertRepeated(card, "pay-copy")
}

// S185 (A142): a first sync that returns one payment twice records it once.
func TestS185RepeatedPaymentInOneRead(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-dec", DueDate: "2026-12-10T00:00:00.000Z", TotalAmount: "0"})
	f.line(pluggy.SubtypeCard, typedCardLine("pay-b", "2026-11-05", "-784.65", "PAGAMENTO_FATURA"))
	copied := typedCardLine("pay-a", "2026-11-05", "-784.65", "PAGAMENTO_FATURA")
	copied.CreditCardMetadata.BillID = new("bill-dec")
	f.line(pluggy.SubtypeCard, copied)

	f.sync()

	// Equal dates order the lines by external id: pay-a is recorded, pay-b repeats it.
	if state, _ := f.recordOf("pay-a"); state != "created" {
		t.Fatalf("pay-a record = %s", state)
	}
	f.assertRepeated(card, "pay-b")
}

// S185 (A142): a credit without a type repeats a payment of the same amount within 3 days,
// as the pending copy of 2026-10-29 did.
func TestS185UntypedCreditRepeatsAPayment(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, typedCardLine("pay-bill", "2026-11-02", "-784.65", "PAGAMENTO_FATURA"))
	f.sync()

	f.line(pluggy.SubtypeCard, cardLine("pay-copy", "2026-11-05", "-784.65", "POSTED", new("bill-nov")))
	f.sync()

	f.assertRepeated(card, "pay-copy")
}

// S185 (A142): equal payments more than 3 days apart, equal credits without a payment and
// equal charges are all recorded.
func TestS185DistinctLinesAreRecorded(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, typedCardLine("pay-1", "2026-11-01", "-500.00", "PAGAMENTO_FATURA"))
	f.line(pluggy.SubtypeCard, typedCardLine("pay-2", "2026-11-05", "-500.00", "PAGAMENTO_FATURA"))
	f.line(pluggy.SubtypeCard, cardLine("credit-1", "2026-11-03", "-30.00", "POSTED", new("bill-nov")))
	f.line(pluggy.SubtypeCard, cardLine("credit-2", "2026-11-03", "-30.00", "POSTED", new("bill-nov")))
	f.line(pluggy.SubtypeCard, cardLine("charge-1", "2026-11-03", "784.65", "POSTED", new("bill-nov")))
	f.line(pluggy.SubtypeCard, cardLine("charge-2", "2026-11-03", "784.65", "POSTED", new("bill-nov")))

	f.sync()

	for _, id := range []string{"pay-1", "pay-2", "credit-1", "credit-2", "charge-1", "charge-2"} {
		if state, _ := f.recordOf(id); state != "created" {
			t.Errorf("%s record = %s, want created", id, state)
		}
	}
	if n := f.count(`SELECT count(*) FROM ledger_posting WHERE account_id = $1 AND NOT voided`, card); n != 6 {
		t.Fatalf("card postings = %d, want 6", n)
	}
}

// assertRepeated checks that the line waits for review as a repeat and that the card holds one
// payment of 784.65.
func (f syncFixture) assertRepeated(card, externalID string) {
	f.h.T().Helper()
	var state string
	var reason, tx *string
	err := f.h.Pool.QueryRow(f.h.T().Context(),
		`SELECT state, review_reason, transaction_id::text FROM ingestion_external_record WHERE external_id = $1`,
		externalID,
	).Scan(&state, &reason, &tx)
	if err != nil {
		f.h.T().Fatal(err)
	}
	if state != "needs_review" || reason == nil || *reason != "repeated" || tx != nil {
		f.h.T().Fatalf("%s record = %s, reason %v, transaction %v", externalID, state, reason, tx)
	}
	payments := f.count(`SELECT count(*) FROM ledger_posting p JOIN ledger_transaction t ON t.id = p.transaction_id
		WHERE p.account_id = $1 AND p.amount = 78465 AND t.voided_at IS NULL`, card)
	if payments != 1 {
		f.h.T().Fatalf("payments of 784.65 = %d, want 1", payments)
	}
}
