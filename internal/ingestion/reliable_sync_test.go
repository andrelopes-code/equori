package ingestion_test

import (
	"fmt"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
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

// S204 (A144): a line the aggregator creates after the last read, dated inside a window
// already read, arrives through the creation read once.
func TestS204LateLineIsRead(t *testing.T) {
	t.Parallel()
	clk := newMovingClock(t, "2026-11-12T12:00:00Z")
	f := newSyncFixture(t, apitest.Clock(clk.now))
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapTo(pluggy.SubtypeCard, card)
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-nov", DueDate: "2026-11-10T00:00:00.000Z", TotalAmount: "0.00"})
	f.sync()

	late := cardLine("late-1", "2026-10-05", "120.00", "POSTED", new("bill-nov"))
	late.CreatedAt = "2026-11-13T11:30:00.000Z"
	f.line(pluggy.SubtypeCard, late)
	clk.set(t, "2026-11-13T12:00:00Z")
	f.sync()

	if state, _ := f.recordOf("late-1"); state != "created" {
		t.Fatalf("late-1 state = %s, want created", state)
	}

	if c := f.batches(card)[0].Counts; c.Created != 1 {
		t.Fatalf("created = %d, want 1", c.Created)
	}

	clk.set(t, "2026-11-14T12:00:00Z")
	f.sync()

	if c := f.batches(card)[0].Counts; c.Ignored != 1 || c.Created != 0 {
		t.Fatalf("counts = ignored %d, created %d, want 1 and 0", c.Ignored, c.Created)
	}

	if n := f.count(`SELECT count(*) FROM ledger_posting WHERE account_id = $1 AND amount = -12000 AND NOT voided`, card); n != 1 {
		t.Fatalf("postings of 120.00 = %d, want 1", n)
	}
}

// S213 (A153): a change to a line older than 30 days is read once a week, by the re-read of
// the last 90 days.
func TestS213PeriodicReread(t *testing.T) {
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
	clk.set(t, "2026-11-13T12:00:00Z")
	f.sync()

	const posting = `SELECT count(*) FROM ledger_posting WHERE transaction_id = $1 AND account_id = $2 AND amount = $3`

	if n := f.count(posting, tx, f.checking, -8000); n != 1 {
		t.Fatalf("postings of -80.00 after the daily sync = %d, want 1", n)
	}

	if c := f.batches(f.checking)[0].Counts; c.Updated != 0 {
		t.Fatalf("updated after the daily sync = %d, want 0", c.Updated)
	}

	clk.set(t, "2026-11-19T12:00:00Z")
	f.sync()

	if n := f.count(posting, tx, f.checking, -8500); n != 1 {
		t.Fatalf("postings of -85.00 after the weekly sync = %d, want 1", n)
	}

	if c := f.batches(f.checking)[0].Counts; c.Updated != 1 {
		t.Fatalf("updated after the weekly sync = %d, want 1", c.Updated)
	}
}

// S205 (A147): an amount change on a reconciled posting leaves the review reason changed and
// counts once; the next sync, with the line unchanged, counts it ignored.
func TestS205AmountChangedAfterReconciliation(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, cardLine("card-5", "2026-11-03", "50.00", "POSTED", new("bill-nov")))
	f.sync()
	_, tx := f.recordOf("card-5")
	f.reconcileStatement(card, "2026-11")

	f.line(pluggy.SubtypeCard, cardLine("card-5", "2026-11-03", "55.00", "POSTED", new("bill-nov")))
	f.sync()

	if p := f.cardPosting(tx, card); p.Status != "reconciled" || p.Amount.Amount != -5000 {
		t.Fatalf("posting = %+v, want reconciled at -5000", p)
	}

	if reason, change := f.recordFacts("card-5"); reason != "changed" || change == "" {
		t.Fatalf("facts = %q, %q, want reason changed and a change", reason, change)
	}

	if c := f.batches(card)[0].Counts; c.Updated != 1 {
		t.Fatalf("updated = %d, want 1", c.Updated)
	}

	f.sync()

	if c := f.batches(card)[0].Counts; c.Updated != 0 || c.Ignored != 1 {
		t.Fatalf("counts = updated %d, ignored %d, want 0 and 1", c.Updated, c.Ignored)
	}

	if p := f.cardPosting(tx, card); p.Amount.Amount != -5000 {
		t.Fatalf("posting amount = %d, want -5000", p.Amount.Amount)
	}
}

// S208 (A147): a reconciled posting that already sits on the line's bill takes the posted
// status without a note and counts ignored.
func TestS208HeldBillWritesNoNote(t *testing.T) {
	t.Parallel()
	f, card := newCardSync(t)
	f.line(pluggy.SubtypeCard, cardLine("card-8", "2026-11-03", "40.00", "PENDING", new("bill-nov")))
	f.sync()
	f.reconcileStatement(card, "2026-11")

	f.line(pluggy.SubtypeCard, cardLine("card-8", "2026-11-03", "40.00", "POSTED", new("bill-nov")))
	f.sync()

	if reason, change := f.recordFacts("card-8"); reason != "" || change != "" {
		t.Fatalf("facts = %q, %q, want none", reason, change)
	}

	if c := f.batches(card)[0].Counts; c.Updated != 0 || c.Ignored != 1 {
		t.Fatalf("counts = updated %d, ignored %d, want 0 and 1", c.Updated, c.Ignored)
	}
}

// S206 (A147): a date change on a reconciled card posting follows the line while the posting
// keeps its statement; a date that leaves the statement, or a bank account, leaves the review
// reason changed.
func TestS206DateChangedAfterReconciliation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		card          bool
		externalID    string
		first         func(id string) pluggy.Transaction
		reconcile     func(f syncFixture, card string)
		changed       func(id string) pluggy.Transaction
		wantDate      string
		wantReason    string
		wantStatement string
		wantAmount    int64
		wantVersion   int
	}{
		{
			name:       "card, same statement",
			card:       true,
			externalID: "card-6",
			first: func(id string) pluggy.Transaction {
				return cardLine(id, "2026-11-03", "7.12", "POSTED", new("bill-nov"))
			},
			reconcile: reconcileCardStatement,
			changed: func(id string) pluggy.Transaction {
				return cardLine(id, "2026-11-02", "7.12", "POSTED", new("bill-nov"))
			},
			wantDate:      "2026-11-02",
			wantStatement: "2026-11",
			wantAmount:    -712,
			wantVersion:   2,
		},
		{
			name:       "card, statement chosen by date moves",
			card:       true,
			externalID: "card-7",
			first: func(id string) pluggy.Transaction {
				return cardLine(id, "2026-11-02", "7.12", "PENDING", nil)
			},
			reconcile: reconcileCardStatement,
			changed: func(id string) pluggy.Transaction {
				return cardLine(id, "2026-11-04", "7.12", "PENDING", nil)
			},
			wantDate:      "2026-11-02",
			wantReason:    "changed",
			wantStatement: "2026-11",
			wantAmount:    -712,
			wantVersion:   1,
		},
		{
			name:       "checking",
			externalID: "tx-6",
			first: func(id string) pluggy.Transaction {
				return bankLine(id, "2026-11-05", "-7.12")
			},
			reconcile: func(f syncFixture, _ string) {
				body := map[string]any{"date": "2026-11-05", "amount": apitest.BRL(-712)}
				f.h.MustDo(http.MethodPost, "/api/v1/accounts/"+f.checking+"/balance-assertions", body, http.StatusCreated, nil)
			},
			changed: func(id string) pluggy.Transaction {
				return bankLine(id, "2026-11-04", "-7.12")
			},
			wantDate:    "2026-11-05",
			wantReason:  "changed",
			wantAmount:  -712,
			wantVersion: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f, account, subtype := newDateFixture(t, tt.card)
			f.line(subtype, tt.first(tt.externalID))
			f.sync()
			_, tx := f.recordOf(tt.externalID)
			tt.reconcile(f, account)

			f.line(subtype, tt.changed(tt.externalID))
			f.sync()

			got := f.h.Transaction(tx)
			if got.Date != tt.wantDate || got.Version != tt.wantVersion {
				t.Fatalf("transaction = %s v%d, want %s v%d", got.Date, got.Version, tt.wantDate, tt.wantVersion)
			}

			p := f.cardPosting(tx, account)
			if p.Status != "reconciled" || p.Statement != tt.wantStatement || p.Amount.Amount != tt.wantAmount {
				t.Fatalf("posting = %+v, want reconciled on %q at %d", p, tt.wantStatement, tt.wantAmount)
			}

			if reason, _ := f.recordFacts(tt.externalID); reason != tt.wantReason {
				t.Fatalf("review reason = %q, want %q", reason, tt.wantReason)
			}

			if tt.wantReason == "" {
				if c := f.batches(account)[0].Counts; c.Updated != 1 {
					t.Fatalf("updated = %d, want 1", c.Updated)
				}
			}
		})
	}
}

// A147 rule 4: a change the ledger refuses leaves the review reason changed; a line that
// returns to the ledger's values clears it. The next sync counts the line ignored.
func TestA147RefusedChangesWaitForReview(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		arrange     func(f syncFixture, card string) (id, tx string)
		changed     func(id string) pluggy.Transaction
		wantReason  string
		wantRole    string
		wantAmount  int64
		wantIgnored bool
	}{
		{
			name: "bill on a reconciled posting",
			arrange: func(f syncFixture, card string) (string, string) {
				f.line(pluggy.SubtypeCard, cardLine("card-b", "2026-11-02", "20.00", "PENDING", nil))
				f.sync()
				f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-dec", DueDate: "2026-12-10T00:00:00.000Z", TotalAmount: "0"})
				f.reconcileStatement(card, "2026-11")
				_, tx := f.recordOf("card-b")

				return "card-b", tx
			},
			changed: func(id string) pluggy.Transaction {
				return cardLine(id, "2026-11-02", "20.00", "POSTED", new("bill-dec"))
			},
			wantReason: "changed",
			wantAmount: -2000,
		},
		{
			name: "refused payment type",
			arrange: func(f syncFixture, card string) (string, string) {
				f.line(pluggy.SubtypeCard, cardLine("pay-1", "2026-11-05", "-961.85", "POSTED", new("bill-nov")))
				f.sync()
				_, tx := f.recordOf("pay-1")
				gifts := f.h.Account("Gifts", "income", "", nil)
				f.h.MustDo(http.MethodPost, "/api/v1/transactions/"+tx+"/categorize", map[string]any{
					"expected_version": 1, "parts": []map[string]any{{"account_id": gifts, "amount": apitest.BRL(-96185)}},
				}, http.StatusOK, nil)

				return "pay-1", tx
			},
			changed: func(id string) pluggy.Transaction {
				return typedCardLine(id, "2026-11-05", "-961.85", "PAGAMENTO_FATURA")
			},
			wantReason: "changed",
			wantRole:   "credit",
			wantAmount: 96185,
		},
		{
			name: "line returns to the ledger's amount",
			arrange: func(f syncFixture, card string) (string, string) {
				f.line(pluggy.SubtypeCard, cardLine("card-5", "2026-11-03", "50.00", "POSTED", new("bill-nov")))
				f.sync()
				_, tx := f.recordOf("card-5")
				f.reconcileStatement(card, "2026-11")
				f.line(pluggy.SubtypeCard, cardLine("card-5", "2026-11-03", "55.00", "POSTED", new("bill-nov")))
				f.sync()

				return "card-5", tx
			},
			changed: func(id string) pluggy.Transaction {
				return cardLine(id, "2026-11-03", "50.00", "POSTED", new("bill-nov"))
			},
			wantAmount:  -5000,
			wantIgnored: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f, card := newCardSync(t)
			id, tx := tt.arrange(f, card)

			f.line(pluggy.SubtypeCard, tt.changed(id))
			f.sync()

			if reason, change := f.recordFacts(id); reason != tt.wantReason || (tt.wantReason == "") != (change == "") {
				t.Fatalf("facts = %q, %q, want reason %q", reason, change, tt.wantReason)
			}

			p := f.cardPosting(tx, card)
			if p.Amount.Amount != tt.wantAmount || (tt.wantRole != "" && p.CardRole != tt.wantRole) {
				t.Fatalf("posting = %+v, want amount %d role %q", p, tt.wantAmount, tt.wantRole)
			}

			if c := f.batches(card)[0].Counts; tt.wantIgnored && c.Ignored != 1 {
				t.Fatalf("changed sync counts = %+v, want ignored 1", c)
			}

			f.sync()

			if c := f.batches(card)[0].Counts; c.Updated != 0 || c.Ignored != 1 {
				t.Fatalf("counts = updated %d, ignored %d, want 0 and 1", c.Updated, c.Ignored)
			}
		})
	}
}

// movingClock is an instance clock a test moves between syncs.
type movingClock struct{ at atomic.Int64 }

func newMovingClock(t *testing.T, at string) *movingClock {
	t.Helper()

	c := &movingClock{}
	c.set(t, at)

	return c
}

func (c *movingClock) now() time.Time { return time.Unix(0, c.at.Load()).UTC() }

// set moves the clock to at, an RFC 3339 instant.
func (c *movingClock) set(t *testing.T, at string) {
	t.Helper()

	v, err := time.Parse(time.RFC3339, at)
	if err != nil {
		t.Fatal(err)
	}

	c.at.Store(v.UnixNano())
}

// recordFacts returns the review reason and the unapplied change of a line's record, empty when null.
func (f syncFixture) recordFacts(externalID string) (reason, change string) {
	f.h.T().Helper()

	var r, c *string
	if err := f.h.Pool.QueryRow(f.h.T().Context(), `SELECT review_reason, unapplied_change FROM ingestion_external_record WHERE external_id = $1`, externalID).Scan(&r, &c); err != nil {
		f.h.T().Fatal(err)
	}

	if r != nil {
		reason = *r
	}

	if c != nil {
		change = *c
	}

	return reason, change
}

// reconcileStatement reconciles the card statement of month (YYYY-MM) at its amount due,
// as TestSyncUpdateOfAReconciledPosting does.
func (f syncFixture) reconcileStatement(card, month string) {
	f.h.T().Helper()

	var statements struct {
		Items []struct {
			ID        string `json:"id"`
			AmountDue struct {
				Amount int64 `json:"amount"`
			} `json:"amount_due"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/statements?from="+month+"&to="+month, nil, http.StatusOK, &statements)

	if len(statements.Items) != 1 {
		f.h.T().Fatalf("statements = %+v, want one", statements.Items)
	}

	st := statements.Items[0]
	f.h.MustDo(http.MethodPost, "/api/v1/statements/"+st.ID+"/reconcile", map[string]any{"amount_due": apitest.BRL(st.AmountDue.Amount)}, http.StatusOK, nil)
}

// newDateFixture returns the fixture of S206: a card, or the checking account, mapped to its
// aggregator account, with that account's id and subtype.
func newDateFixture(t *testing.T, card bool) (f syncFixture, account, subtype string) {
	t.Helper()

	if card {
		f, account = newCardSync(t)

		return f, account, pluggy.SubtypeCard
	}

	f = newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)

	return f, f.checking, pluggy.SubtypeChecking
}

func reconcileCardStatement(f syncFixture, card string) {
	f.h.T().Helper()
	f.reconcileStatement(card, "2026-11")
}
