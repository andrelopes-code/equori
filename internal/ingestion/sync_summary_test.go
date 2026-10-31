package ingestion_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

// A149: the batches of one sync run share its id; the next run has another.
func TestA149BatchesOfOneSyncShareItsID(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.sync()

	a, b := f.batches(card)[0].SyncID, f.batches(f.checking)[0].SyncID
	if a == "" || a != b {
		t.Fatalf("sync ids = %q, %q; want one non-empty id", a, b)
	}

	f.sync()

	if next := f.batches(card)[0].SyncID; next == a {
		t.Fatalf("second sync reused sync id %q", a)
	}
}

// A148: a zone link of a sync is a decision of the run that made it.
func TestA148LinkIsADecision(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Uber": "Uberrides"})
	m.manual("2026-10-20", -712, "Uber", "Uber")
	m.lineOn("uber-1", "2026-10-20", "Dl *Uberrides", "-7.12")
	m.sync()

	decision, batch, kept := m.decisionOf("uber-1")
	if decision != "linked" || batch != m.batches(m.checking)[0].ID || kept {
		t.Fatalf("decision = %q, %q, %v; want linked in the batch of the run", decision, batch, kept)
	}
}

// A148: a withdrawal keeps what the record was; a returned line is linked again.
func TestA148WithdrawalIsADecision(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-11-05", "-10.00"))
	f.line(pluggy.SubtypeChecking, bankLine("tx-2", "2026-11-06", "-20.00"))
	f.sync()

	_, tx := f.recordOf("tx-1")

	if decision, batch, kept := f.decisionOf("tx-1"); decision != "" || batch != f.batches(f.checking)[0].ID || kept {
		t.Fatalf("decision after the first sync = %q, %q, %v; want none in the batch of the run", decision, batch, kept)
	}

	f.p.RemoveTransaction(nubankItem+"-checking", "tx-1")
	f.sync()

	if decision, batch, kept := f.decisionOf("tx-1"); decision != "withdrawn" || batch != f.batches(f.checking)[0].ID || kept {
		t.Fatalf("decision after the withdrawal = %q, %q, %v; want withdrawn in the batch of the run", decision, batch, kept)
	}

	const stored = `SELECT decision_undo->>'state' || ' ' || (decision_undo->>'transaction_id')
		FROM ingestion_external_record WHERE external_id = 'tx-1'`
	if got := f.text(stored); got != "created "+tx {
		t.Fatalf("undo = %q, want %q", got, "created "+tx)
	}

	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-11-05", "-10.00"))
	f.sync()

	if decision, batch, kept := f.decisionOf("tx-1"); decision != "linked" || batch != f.batches(f.checking)[0].ID || kept {
		t.Fatalf("decision after the return = %q, %q, %v; want linked in the batch of the run", decision, batch, kept)
	}

	if state, got := f.recordOf("tx-1"); state != "matched" || got != tx {
		t.Fatalf("record = %s on %s, want matched on %s", state, got, tx)
	}
}

// A148: a re-identification keeps the previous external id.
func TestA148ReidentificationIsADecision(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	paid := typedCardLine("pay-1", "2026-11-05", "-784.65", "PAGAMENTO_FATURA")
	paid.ProviderID = new("p-1")
	f.line(pluggy.SubtypeCard, paid)
	f.sync()

	f.p.RemoveTransaction(nubankItem+"-card", "pay-1")

	again := typedCardLine("pay-2", "2026-11-05", "-784.65", "PAGAMENTO_FATURA")
	again.ProviderID = new("p-1")
	f.line(pluggy.SubtypeCard, again)
	f.sync()

	if decision, batch, kept := f.decisionOf("pay-2"); decision != "re_identified" || batch != f.batches(card)[0].ID || kept {
		t.Fatalf("decision = %q, %q, %v; want re_identified in the batch of the run", decision, batch, kept)
	}

	const stored = `SELECT decision_undo->>'external_id' FROM ingestion_external_record WHERE external_id = 'pay-2'`
	if got := f.text(stored); got != "pay-1" {
		t.Fatalf("undo external id = %q, want pay-1", got)
	}
}

// A148: a followed change keeps the ledger's amount and date.
func TestA148FollowedChangeIsADecision(t *testing.T) {
	t.Parallel()
	clk := newMovingClock(t, "2026-11-12T12:00:00Z")
	f := newSyncFixture(t, apitest.Clock(clk.now))

	r := f.mapAccount(f.h.Client, f.conn.ID, externalAccount(f.conn, pluggy.SubtypeChecking).ID, map[string]any{"account_id": f.checking, "sync_from": "2026-08-01"})
	if r.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", r.Status, r.Body)
	}

	f.line(pluggy.SubtypeChecking, bankLine("old-1", "2026-09-13", "-80.00"))
	f.sync()

	f.line(pluggy.SubtypeChecking, bankLine("old-1", "2026-09-13", "-85.00"))
	clk.set(t, "2026-11-19T12:00:00Z")
	f.sync()

	if decision, batch, kept := f.decisionOf("old-1"); decision != "followed" || batch != f.batches(f.checking)[0].ID || kept {
		t.Fatalf("decision = %q, %q, %v; want followed in the batch of the run", decision, batch, kept)
	}

	const stored = `SELECT (decision_undo->>'amount') || ' ' || (decision_undo->>'on')
		FROM ingestion_external_record WHERE external_id = 'old-1'`
	if got := f.text(stored); got != "-8000 2026-09-13" {
		t.Fatalf("undo = %q, want %q", got, "-8000 2026-09-13")
	}
}

// A149: a change that leaves review reason changed is listed in the run's batch without a
// decision; a run that leaves it unchanged keeps the batch.
func TestA149ReviewChangeIsListedWithoutDecision(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, cardLine("card-5", "2026-11-03", "50.00", "POSTED", new("bill-nov")))
	f.sync()
	f.reconcileStatement(card, "2026-11")

	f.line(pluggy.SubtypeCard, cardLine("card-5", "2026-11-03", "55.00", "POSTED", new("bill-nov")))
	f.sync()

	if decision, batch, kept := f.decisionOf("card-5"); decision != "" || batch != f.batches(card)[0].ID || kept {
		t.Fatalf("decision = %q, %q, %v; want none in the batch of the run", decision, batch, kept)
	}

	f.sync()

	if _, batch, _ := f.decisionOf("card-5"); batch != f.batches(card)[1].ID {
		t.Fatalf("summary batch = %q, want the batch of the run that changed it, %q", batch, f.batches(card)[1].ID)
	}
}

// S212 (A148): undoing a zone link releases the posting and returns the line to review.
func TestS212UndoLinkedLine(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Uber": "Uberrides"})
	entry := m.manual("2026-10-20", -712, "Uber", "Uber")
	m.lineOn("uber-1", "2026-10-20", "Dl *Uberrides", "-7.12")
	m.sync()

	r := m.undo("uber-1")
	if r.Status != http.StatusOK {
		t.Fatalf("undo status = %d, body %s", r.Status, r.Body)
	}

	var got struct {
		State         string   `json:"state"`
		ReviewReason  string   `json:"review_reason"`
		Candidates    []string `json:"candidates"`
		TransactionID string   `json:"transaction_id"`
		Decision      string   `json:"decision"`
	}
	r.Decode(t, &got)

	if got.State != "needs_review" || got.ReviewReason != "probable" || !slices.Equal(got.Candidates, []string{entry}) ||
		got.TransactionID != "" || got.Decision != "" {
		t.Fatalf("undone record = %+v, want needs_review, probable, candidate %s, no transaction, no decision", got, entry)
	}

	if c := m.batches(m.checking)[0].Counts; c.Matched != 0 || c.NeedsReview != 1 {
		t.Fatalf("counts = matched %d, needs_review %d, want 0 and 1", c.Matched, c.NeedsReview)
	}

	m.h.ExpectProblem(m.undo("uber-1"), http.StatusConflict, "no_decision", "")

	m.sync()

	if state, tx := m.recordOf("uber-1"); state != "needs_review" || tx != "" {
		t.Fatalf("record after the next sync = %s on %q, want needs_review without a transaction", state, tx)
	}

	linked := m.count("SELECT count(*) FROM ledger_posting WHERE transaction_id = $1 AND external_record_id IS NOT NULL", entry)
	if linked != 0 {
		t.Fatalf("postings of the entry linked to a record = %d, want 0", linked)
	}
}

// S212 (A148): undoing a withdrawal links the line to its posting again and keeps it from
// later withdrawals.
func TestS212UndoWithdrawnLine(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-11-05", "-10.00"))
	f.line(pluggy.SubtypeChecking, bankLine("tx-2", "2026-11-06", "-20.00"))
	f.sync()

	_, tx := f.recordOf("tx-1")

	f.p.RemoveTransaction(nubankItem+"-checking", "tx-1")
	f.sync()

	r := f.undo("tx-1")
	if r.Status != http.StatusOK {
		t.Fatalf("undo status = %d, body %s", r.Status, r.Body)
	}

	var got struct {
		State         string `json:"state"`
		TransactionID string `json:"transaction_id"`
	}
	r.Decode(t, &got)

	if got.State != "created" || got.TransactionID != tx {
		t.Fatalf("undone record = %s on %s, want created on %s", got.State, got.TransactionID, tx)
	}

	if _, _, kept := f.decisionOf("tx-1"); !kept {
		t.Fatal("kept = false after the undo, want true")
	}

	f.sync()

	if state, got := f.recordOf("tx-1"); state != "created" || got != tx {
		t.Fatalf("record after the next sync = %s on %s, want created on %s", state, got, tx)
	}

	if w := f.batches(f.checking)[0].Counts.Withdrawn; w != 0 {
		t.Fatalf("withdrawn = %d, want 0", w)
	}

	f.h.ExpectProblem(f.undo("tx-1"), http.StatusConflict, "no_decision", "")
}

// A148: the posting of a withdrawn record that another line took cannot be linked back.
func TestA148UndoOfAWithdrawalWhoseEntryIsLinkedAgain(t *testing.T) {
	t.Parallel()
	f, _ := newCardSync(t)
	f.line(pluggy.SubtypeCard, cardLine("card-p", "2026-11-12", "30.00", "PENDING", nil))
	f.sync()

	f.p.RemoveTransaction(nubankItem+"-card", "card-p")
	f.line(pluggy.SubtypeCard, cardLine("card-q", "2026-11-12", "30.00", "POSTED", nil))
	f.sync()

	f.h.ExpectProblem(f.undo("card-p"), http.StatusConflict, "already_matched", "")

	if decision, _, _ := f.decisionOf("card-p"); decision != "withdrawn" {
		t.Fatalf("decision = %q, want withdrawn", decision)
	}
}

// A148: a line a sync did not decide has nothing to undo.
func TestA148UndoWithoutDecision(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-11-05", "-10.00"))
	f.sync()

	f.h.ExpectProblem(f.undo("tx-1"), http.StatusConflict, "no_decision", "")
}

// S206 (A148): undoing a followed date restores the ledger's date on a reconciled card posting
// and keeps the posting on its statement; the next sync counts nothing.
func TestS206UndoFollowedDate(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, cardLine("card-6", "2026-11-03", "7.12", "POSTED", new("bill-nov")))
	f.sync()

	_, tx := f.recordOf("card-6")

	f.reconcileStatement(card, "2026-11")
	f.line(pluggy.SubtypeCard, cardLine("card-6", "2026-11-02", "7.12", "POSTED", new("bill-nov")))
	f.sync()

	r := f.undo("card-6")
	if r.Status != http.StatusOK {
		t.Fatalf("undo status = %d, body %s", r.Status, r.Body)
	}

	var got struct {
		ReviewReason string `json:"review_reason"`
		Date         string `json:"date"`
		Decision     string `json:"decision"`
	}
	r.Decode(t, &got)

	if got.ReviewReason != "changed" || got.Date != "2026-11-03" || got.Decision != "" {
		t.Fatalf("undone record = %+v, want changed on 2026-11-03 without decision", got)
	}

	if tr := f.h.Transaction(tx); tr.Date != "2026-11-03" || tr.Version != 3 {
		t.Fatalf("transaction = %s v%d, want 2026-11-03 v3", tr.Date, tr.Version)
	}

	if p := f.cardPosting(tx, card); p.Status != "reconciled" || p.Statement != "2026-11" || p.Amount.Amount != -712 {
		t.Fatalf("posting = %+v, want reconciled on 2026-11 at -712", p)
	}

	const note = "the aggregator reports -712 minor units on 2026-11-02; the ledger keeps -712 on 2026-11-03"
	if reason, change := f.recordFacts("card-6"); reason != "changed" || change != note {
		t.Fatalf("facts = %q, %q; want changed, %q", reason, change, note)
	}

	f.sync()

	if c := f.batches(card)[0].Counts; c.Updated != 0 || c.Ignored != 1 {
		t.Fatalf("counts = updated %d, ignored %d, want 0 and 1", c.Updated, c.Ignored)
	}

	if tr := f.h.Transaction(tx); tr.Date != "2026-11-03" {
		t.Fatalf("transaction date after the next sync = %s, want 2026-11-03", tr.Date)
	}
}

// S213 (A148): undoing a followed amount restores the ledger's amount on an unreconciled
// posting.
func TestS213UndoFollowedAmount(t *testing.T) {
	t.Parallel()
	clk := newMovingClock(t, "2026-11-12T12:00:00Z")
	f := newSyncFixture(t, apitest.Clock(clk.now))

	r := f.mapAccount(f.h.Client, f.conn.ID, externalAccount(f.conn, pluggy.SubtypeChecking).ID, map[string]any{"account_id": f.checking, "sync_from": "2026-08-01"})
	if r.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", r.Status, r.Body)
	}

	f.line(pluggy.SubtypeChecking, bankLine("old-1", "2026-09-13", "-80.00"))
	f.sync()

	_, tx := f.recordOf("old-1")

	f.line(pluggy.SubtypeChecking, bankLine("old-1", "2026-09-13", "-85.00"))
	clk.set(t, "2026-11-19T12:00:00Z")
	f.sync()

	if u := f.undo("old-1"); u.Status != http.StatusOK {
		t.Fatalf("undo status = %d, body %s", u.Status, u.Body)
	}

	const posting = `SELECT count(*) FROM ledger_posting WHERE transaction_id = $1 AND account_id = $2 AND amount = $3`
	if n := f.count(posting, tx, f.checking, -8000); n != 1 {
		t.Fatalf("postings of -80.00 after the undo = %d, want 1", n)
	}

	const note = "the aggregator reports -8500 minor units on 2026-09-13; the ledger keeps -8000 on 2026-09-13"
	if reason, change := f.recordFacts("old-1"); reason != "changed" || change != note {
		t.Fatalf("facts = %q, %q; want changed, %q", reason, change, note)
	}

	f.h.ExpectProblem(f.undo("old-1"), http.StatusConflict, "no_decision", "")
}

// A148: undoing a re-identification restores the previous external id and returns the line to
// review as a new record of the run's batch.
func TestA148UndoReidentification(t *testing.T) {
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

	id := f.recordID("pay-2")

	r := f.h.Do(http.MethodPost, "/api/v1/external-records/"+id+"/undo", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("undo status = %d, body %s", r.Status, r.Body)
	}

	var got struct {
		ExternalID    string `json:"external_id"`
		State         string `json:"state"`
		TransactionID string `json:"transaction_id"`
	}
	r.Decode(t, &got)

	if got.ExternalID != "pay-1" || got.State != "created" || got.TransactionID != tx {
		t.Fatalf("undone record = %+v, want pay-1 created on %s", got, tx)
	}

	if state, linked := f.recordOf("pay-2"); state != "needs_review" || linked != "" {
		t.Fatalf("pay-2 record = %s on %q, want needs_review without a transaction", state, linked)
	}

	if reason, _ := f.recordFacts("pay-2"); reason != "probable" {
		t.Fatalf("pay-2 review reason = %q, want probable", reason)
	}

	const batchOf = `SELECT batch_id::text FROM ingestion_external_record WHERE external_id = 'pay-2'`

	b := f.batches(card)[0]
	if got := f.text(batchOf); got != b.ID || b.Counts.NeedsReview != 1 {
		t.Fatalf("pay-2 batch = %s, needs_review = %d; want %s and 1", got, b.Counts.NeedsReview, b.ID)
	}

	f.h.ExpectProblem(f.undo("pay-1"), http.StatusConflict, "no_decision", "")
	f.h.ExpectProblem(f.undo("pay-2"), http.StatusConflict, "no_decision", "")
}

// recordID returns the id of a line's record.
func (f syncFixture) recordID(externalID string) string {
	f.h.T().Helper()

	return f.text(`SELECT id::text FROM ingestion_external_record WHERE external_id = $1`, externalID)
}

// text returns the one text value sql selects.
func (f syncFixture) text(sql string, args ...any) string {
	f.h.T().Helper()

	var out string
	if err := f.h.Pool.QueryRow(f.h.T().Context(), sql, args...).Scan(&out); err != nil {
		f.h.T().Fatal(err)
	}

	return out
}

// decisionOf returns a line's decision, summary batch and kept mark, empty when null.
func (f syncFixture) decisionOf(externalID string) (decision, summaryBatch string, kept bool) {
	f.h.T().Helper()

	var d, s *string
	if err := f.h.Pool.QueryRow(f.h.T().Context(), `SELECT decision, summary_batch_id::text, kept FROM ingestion_external_record WHERE external_id = $1`, externalID).Scan(&d, &s, &kept); err != nil {
		f.h.T().Fatal(err)
	}

	if d != nil {
		decision = *d
	}

	if s != nil {
		summaryBatch = *s
	}

	return decision, summaryBatch, kept
}

// undo posts the undo of a line's record decision.
func (f syncFixture) undo(externalID string) apitest.Response {
	f.h.T().Helper()

	return f.h.Do(http.MethodPost, "/api/v1/external-records/"+f.recordID(externalID)+"/undo", nil)
}
