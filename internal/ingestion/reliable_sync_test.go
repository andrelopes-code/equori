package ingestion_test

import (
	"fmt"
	"testing"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

// A143: a stored record that the aggregator later reports with an institution line id
// stores the id and counts the line as ignored.
func TestA143StoredRecordReceivesItsInstitutionID(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-11-05", "-10.00"))
	f.sync()

	line := bankLine("tx-1", "2026-11-05", "-10.00")
	line.ProviderID = new("p-1")
	f.line(pluggy.SubtypeChecking, line)
	f.sync()

	var got string
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT institution_id FROM ingestion_external_record WHERE external_id = 'tx-1'`).Scan(&got); err != nil {
		t.Fatal(err)
	}

	if got != "p-1" {
		t.Fatalf("institution_id = %q, want p-1", got)
	}

	if c := f.batches(f.checking)[0].Counts; c.Updated != 0 || c.Ignored != 1 {
		t.Fatalf("counts = %+v, want updated 0 and ignored 1", c)
	}
}

// S203 (A143): a payment the bank returns under a new id and the same institution line id is
// one payment, not two.
func TestS203RepeatedPaymentIsReidentified(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	paid := typedCardLine("pay-1", "2026-11-05", "-784.65", "PAGAMENTO_FATURA")
	paid.ProviderID = new("p-1")
	f.line(pluggy.SubtypeCard, paid)
	f.sync()

	_, tx := f.recordOf("pay-1")

	f.p.RemoveTransaction(nubankItem+"-card", "pay-1")

	again := typedCardLine("pay-2", "2026-11-05", "-784.65", "PAGAMENTO_FATURA")
	again.ProviderID = new("p-1")
	f.line(pluggy.SubtypeCard, again)
	f.sync()

	state, got := f.recordOf("pay-2")
	if state != "created" || got != tx {
		t.Fatalf("pay-2 record = %s on %s, want created on %s", state, got, tx)
	}

	if n := f.count(`SELECT count(*) FROM ingestion_external_record WHERE external_id = 'pay-1'`); n != 0 {
		t.Fatalf("records of pay-1 = %d, want 0", n)
	}

	c := f.batches(card)[0].Counts
	if c.ReIdentified != 1 || c.Created != 0 || c.Withdrawn != 0 {
		t.Fatalf("counts = %+v, want re-identified 1, created 0, withdrawn 0", c)
	}

	payments := f.count(`SELECT count(*) FROM ledger_posting p JOIN ledger_transaction t ON t.id = p.transaction_id
		WHERE p.account_id = $1 AND p.amount = 78465 AND t.voided_at IS NULL`, card)
	if payments != 1 {
		t.Fatalf("payments of 784.65 = %d, want 1", payments)
	}
}

// S207 (A145): a pending line posted under a new id on the sync day finds its released posting.
func TestS207PendingLinePostedUnderANewIDOnTheSyncDay(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, cardLine("card-p", "2026-11-12", "30.00", "PENDING", nil))
	f.sync()

	_, tx := f.recordOf("card-p")

	f.p.RemoveTransaction(nubankItem+"-card", "card-p")
	f.line(pluggy.SubtypeCard, cardLine("card-q", "2026-11-12", "30.00", "POSTED", nil))
	f.sync()

	if state, _ := f.recordOf("card-p"); state != "withdrawn" {
		t.Fatalf("card-p state = %s, want withdrawn", state)
	}

	state, got := f.recordOf("card-q")
	if state != "matched" || got != tx {
		t.Fatalf("card-q record = %s on %s, want matched on %s", state, got, tx)
	}

	postings := f.count(`SELECT count(*) FROM ledger_posting WHERE account_id = $1 AND NOT voided`, card)
	if postings != 1 {
		t.Fatalf("postings of the card = %d, want 1", postings)
	}
}

// S209 (A146): a read that returns no line while the account holds records withdraws nothing.
func TestS209EmptyReadWithdrawsNothing(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)

	ids := []string{"tx-1", "tx-2", "tx-3", "tx-4", "tx-5"}
	for i, id := range ids {
		f.line(pluggy.SubtypeChecking, bankLine(id, fmt.Sprintf("2026-11-%02d", i+2), "-10.00"))
	}

	f.sync()

	for _, id := range ids {
		f.p.RemoveTransaction(nubankItem+"-checking", id)
	}

	f.sync()

	for _, id := range ids {
		if state, _ := f.recordOf(id); state != "created" {
			t.Fatalf("%s state = %s, want created", id, state)
		}
	}

	b := f.batches(f.checking)[0]
	if b.Counts.Withdrawn != 0 || !b.ReadEmpty {
		t.Fatalf("batch = withdrawn %d, read_empty %v, want 0 and true", b.Counts.Withdrawn, b.ReadEmpty)
	}
}

// A145: sync_from bounds the import; a line dated before it is read and not recorded.
func TestA145LineBeforeSyncFromIsDropped(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.line(pluggy.SubtypeChecking, bankLine("tx-0", "2026-09-30", "-10.00"))
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-01", "-10.00"))
	f.sync()

	if n := f.count(`SELECT count(*) FROM ingestion_external_record WHERE external_id = 'tx-0'`); n != 0 {
		t.Fatalf("records of tx-0 = %d, want 0", n)
	}

	if state, _ := f.recordOf("tx-1"); state != "created" {
		t.Fatalf("tx-1 state = %s, want created", state)
	}

	if c := f.batches(f.checking)[0].Counts; c.Received != 1 {
		t.Fatalf("received = %d, want 1", c.Received)
	}
}
