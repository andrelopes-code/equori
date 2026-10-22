package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

type syncBatch struct {
	ID                string `json:"id"`
	AccountID         string `json:"account_id"`
	Source            string `json:"source"`
	ExternalAccountID string `json:"external_account_id"`
	PeriodFrom        string `json:"period_from"`
	PeriodTo          string `json:"period_to"`
	Counts            struct {
		Received    int `json:"received"`
		Ignored     int `json:"ignored"`
		Matched     int `json:"matched"`
		Created     int `json:"created"`
		NeedsReview int `json:"needs_review"`
		Updated     int `json:"updated"`
		Withdrawn   int `json:"withdrawn"`
	} `json:"counts"`
	Balance struct {
		Status string `json:"status"`
		Date   string `json:"date"`
		Amount struct {
			Amount int64 `json:"amount"`
		} `json:"amount"`
	} `json:"balance"`
}

// syncFixture is the owner of S51 with item Nubank connected through one integration.
type syncFixture struct {
	aggregator
	conn     connectionView
	checking string // Nubank checking in the ledger
}

func newSyncFixture(t *testing.T) syncFixture {
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "Nubank")
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	f := syncFixture{aggregator: a, conn: a.mustConnect(a.h.Client, in.ID, nubankItem)}
	f.checking = a.h.Account("Nubank checking", "asset", "checking", nil)
	return f
}

func (f syncFixture) mapTo(subtype, account string) {
	f.h.T().Helper()
	r := f.mapAccount(f.h.Client, f.conn.ID, externalAccount(f.conn, subtype).ID, map[string]any{"account_id": account, "sync_from": "2026-10-01"})
	if r.Status != http.StatusOK {
		f.h.T().Fatalf("map status %d: %s", r.Status, r.Body)
	}
}

func (f syncFixture) sync() {
	f.h.T().Helper()
	if err := f.h.App.Ingestion.SyncConnection(f.h.T().Context(), f.h.OwnerID(), uuid.MustParse(f.conn.ID)); err != nil {
		f.h.T().Fatalf("sync: %v", err)
	}
}

// batches returns the aggregator batches of an account, newest first.
func (f syncFixture) batches(account string) []syncBatch {
	f.h.T().Helper()
	var out struct {
		Items []syncBatch `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/import-batches", nil, http.StatusOK, &out)
	var mine []syncBatch
	for _, b := range out.Items {
		if b.AccountID == account {
			mine = append(mine, b)
		}
	}
	return mine
}

func (f syncFixture) line(subtype string, t pluggy.Transaction) {
	f.p.AddTransaction(nubankItem+"-"+map[string]string{
		pluggy.SubtypeChecking: "checking", pluggy.SubtypeCard: "card", pluggy.SubtypeSavings: "savings",
	}[subtype], t)
}

func bankLine(id, date string, amount pluggy.Decimal) pluggy.Transaction {
	return pluggy.Transaction{ID: id, Description: "line " + id, Amount: amount, CurrencyCode: "BRL", Date: date + "T00:00:00.000Z", Status: "POSTED"}
}

func (f syncFixture) recordOf(externalID string) (state, transaction string) {
	f.h.T().Helper()
	var tx *string
	if err := f.h.Pool.QueryRow(f.h.T().Context(), `SELECT state, transaction_id::text FROM ingestion_external_record WHERE external_id = $1`, externalID).Scan(&state, &tx); err != nil {
		f.h.T().Fatal(err)
	}
	if tx != nil {
		transaction = *tx
	}
	return state, transaction
}

func (f syncFixture) count(sql string, args ...any) int {
	f.h.T().Helper()
	var n int
	if err := f.h.Pool.QueryRow(f.h.T().Context(), sql, args...).Scan(&n); err != nil {
		f.h.T().Fatal(err)
	}
	return n
}

// S52: the first sync of Nubank checking matches the manual entry, creates two lines and
// asserts the balance; repeated syncs create nothing (SC2).
func TestSyncBankAccount(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	food := f.h.Account("Food", "expense", "", nil)
	manual := f.h.Record("2026-10-04", apitest.Posting(f.checking, -4590), apitest.Posting(food, 4590))
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-05", "-45.90"))
	f.line(pluggy.SubtypeChecking, bankLine("tx-2", "2026-10-12", "-120.00"))
	f.line(pluggy.SubtypeChecking, bankLine("tx-3", "2026-10-15", "3000.00"))
	f.mapTo(pluggy.SubtypeChecking, f.checking)

	f.sync()
	bs := f.batches(f.checking)
	if len(bs) != 1 {
		t.Fatalf("batches = %+v", bs)
	}
	b := bs[0]
	if b.Source != "aggregator" || b.ExternalAccountID != externalAccount(f.conn, pluggy.SubtypeChecking).ID || b.PeriodFrom != "2026-10-01" || b.PeriodTo != "2026-11-12" ||
		b.Counts.Received != 3 || b.Counts.Matched != 1 || b.Counts.Created != 2 || b.Counts.Ignored != 0 ||
		b.Balance.Status != "recorded" || b.Balance.Date != "2026-11-12" || b.Balance.Amount.Amount != 283410 {
		t.Fatalf("batch = %+v", b)
	}
	if state, tx := f.recordOf("tx-1"); state != "matched" || tx != manual {
		t.Fatalf("tx-1 = %s on %s, want matched on %s", state, tx, manual)
	}
	for _, p := range f.h.Transaction(manual).Postings {
		if p.AccountID == f.checking && p.Status != "reconciled" {
			t.Fatalf("manual posting = %+v; the assertion must reconcile the account", p)
		}
	}
	if n := f.count(`SELECT count(*) FROM ledger_reconciliation WHERE account_id = $1 AND difference = 0`, f.checking); n != 1 {
		t.Fatalf("reconciliations = %d", n)
	}

	transactions := transactionCount(t, f.h)
	for range 2 {
		f.sync()
	}
	bs = f.batches(f.checking)
	// The window starts 30 days before the last synced date: only tx-3 is read again.
	if len(bs) != 3 || bs[0].Counts.Received != 1 || bs[0].Counts.Ignored != 1 || bs[0].Counts.Created+bs[0].Counts.Matched+bs[0].Counts.Updated != 0 ||
		bs[0].Balance.Status != "none" || bs[0].PeriodFrom != "2026-10-13" {
		t.Fatalf("repeated batch = %+v", bs[0])
	}
	if got := transactionCount(t, f.h); got != transactions {
		t.Fatalf("transactions %d → %d", transactions, got)
	}
	if n := f.count(`SELECT count(*) FROM ledger_balance_assertion WHERE account_id = $1`, f.checking); n != 1 {
		t.Fatalf("assertions = %d", n)
	}
	var synced string
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT last_synced_on::text FROM ingestion_external_account WHERE account_id = $1`, f.checking).Scan(&synced); err != nil || synced != "2026-11-12" {
		t.Fatalf("last_synced_on = %q, %v", synced, err)
	}
}

// S55: a line returned with a new id after its old id disappeared matches the existing
// transaction, although the assertion of the first sync reconciled it (A38).
func TestSyncWithdrawnLine(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-20", "-120.00"))
	f.line(pluggy.SubtypeChecking, bankLine("tx-2", "2026-10-25", "3000.00"))
	f.p.SetAccountBalance(nubankItem+"-checking", "2880.00")
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.sync()
	_, original := f.recordOf("tx-1")
	transactions := transactionCount(t, f.h)

	f.p.RemoveTransaction(nubankItem+"-checking", "tx-1")
	f.line(pluggy.SubtypeChecking, bankLine("tx-1b", "2026-10-20", "-120.00"))
	f.sync()
	if state, tx := f.recordOf("tx-1"); state != "withdrawn" || tx != "" {
		t.Fatalf("old record = %s on %q", state, tx)
	}
	if state, tx := f.recordOf("tx-1b"); state != "matched" || tx != original {
		t.Fatalf("new record = %s on %s, want matched on %s", state, tx, original)
	}
	if got := transactionCount(t, f.h); got != transactions {
		t.Fatalf("transactions %d → %d", transactions, got)
	}
	if b := f.batches(f.checking)[0]; b.Counts.Received != 2 || b.Counts.Withdrawn != 1 || b.Counts.Matched != 1 || b.Counts.Ignored != 1 {
		t.Fatalf("batch = %+v", b)
	}
	// Returned again beside tx-1b, the first id is a second line: its posting is taken, so
	// it is created.
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-20", "-120.00"))
	f.sync()
	if state, tx := f.recordOf("tx-1"); state != "created" || tx == original {
		t.Fatalf("returned record = %s on %s", state, tx)
	}
}

func cardLine(id, date string, amount pluggy.Decimal, status string, billID *string) pluggy.Transaction {
	t := pluggy.Transaction{ID: id, Description: "card " + id, Amount: amount, CurrencyCode: "BRL", Date: date + "T00:00:00.000Z", Status: status}
	if billID != nil {
		t.CreditCardMetadata = &pluggy.CardMetadata{BillID: billID}
	}
	return t
}

func (f syncFixture) cardPosting(id string, card string) apitest.PostingView {
	f.h.T().Helper()
	for _, p := range f.h.Transaction(id).Postings {
		if p.AccountID == card {
			return p
		}
	}
	f.h.T().Fatalf("transaction %s has no posting on the card", id)
	return apitest.PostingView{}
}

// S53: a pending card charge is billed by the cycle; posted with a bill due 2026-12-10, it
// turns cleared on statement 2026-12 (A36, A39).
func TestSyncCardChargeIsPostedOnTheBill(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapTo(pluggy.SubtypeCard, card)
	f.line(pluggy.SubtypeCard, cardLine("card-1", "2026-11-02", "230.00", "PENDING", nil))
	f.sync()
	_, tx := f.recordOf("card-1")
	if p := f.cardPosting(tx, card); p.Amount.Amount != -23000 || p.Status != "pending" || p.CardRole != "charge" || p.Statement != "2026-11" {
		t.Fatalf("pending posting = %+v", p)
	}

	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-dec", DueDate: "2026-12-10T00:00:00.000Z", TotalAmount: "230.00"})
	f.line(pluggy.SubtypeCard, cardLine("card-1", "2026-11-02", "230.00", "POSTED", new("bill-dec")))
	f.sync()
	if p := f.cardPosting(tx, card); p.Status != "cleared" || p.Statement != "2026-12" || p.Amount.Amount != -23000 {
		t.Fatalf("posted posting = %+v", p)
	}
	if b := f.batches(card)[0]; b.Counts.Updated != 1 || b.Counts.Ignored != 0 || b.Counts.Received != 1 || b.Balance.Status != "none" {
		t.Fatalf("batch = %+v", b)
	}
}

// Deferred P6 minor: a pending charge whose id disappears and comes back posted under a new
// id with a bill matches its transaction and moves it to the bill's statement, as S53 does
// for an unchanged id.
func TestSyncCardChargePostedUnderANewID(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapTo(pluggy.SubtypeCard, card)
	f.line(pluggy.SubtypeCard, cardLine("card-1", "2026-11-02", "230.00", "PENDING", nil))
	f.sync()
	_, tx := f.recordOf("card-1")

	f.p.RemoveTransaction(nubankItem+"-card", "card-1")
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-dec", DueDate: "2026-12-10T00:00:00.000Z", TotalAmount: "230.00"})
	f.line(pluggy.SubtypeCard, cardLine("card-1b", "2026-11-02", "230.00", "POSTED", new("bill-dec")))
	f.sync()
	if state, matched := f.recordOf("card-1b"); state != "matched" || matched != tx {
		t.Fatalf("new record = %s on %s, want matched on %s", state, matched, tx)
	}
	if p := f.cardPosting(tx, card); p.Status != "cleared" || p.Statement != "2026-12" || p.Amount.Amount != -23000 {
		t.Fatalf("posted posting = %+v", p)
	}
}

// P6 Review Focus 3: a posted update for a reconciled posting changes nothing in the ledger
// and records the difference on the record.
func TestSyncUpdateOfAReconciledPosting(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapTo(pluggy.SubtypeCard, card)
	f.line(pluggy.SubtypeCard, cardLine("card-1", "2026-11-02", "230.00", "PENDING", nil))
	f.sync()
	_, tx := f.recordOf("card-1")
	var statements struct {
		Items []struct {
			ID        string `json:"id"`
			Reference string `json:"reference"`
			AmountDue struct {
				Amount int64 `json:"amount"`
			} `json:"amount_due"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/statements?from=2026-11&to=2026-11", nil, http.StatusOK, &statements)
	if len(statements.Items) != 1 {
		t.Fatalf("statements = %+v", statements.Items)
	}
	st := statements.Items[0]
	f.h.MustDo(http.MethodPost, "/api/v1/statements/"+st.ID+"/reconcile", map[string]any{"amount_due": apitest.BRL(st.AmountDue.Amount)}, http.StatusOK, nil)

	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-dec", DueDate: "2026-12-10T00:00:00.000Z", TotalAmount: "230.00"})
	f.line(pluggy.SubtypeCard, cardLine("card-1", "2026-11-02", "231.50", "POSTED", new("bill-dec")))
	f.sync()
	if p := f.cardPosting(tx, card); p.Status != "reconciled" || p.Statement != "2026-11" || p.Amount.Amount != -23000 {
		t.Fatalf("reconciled posting changed: %+v", p)
	}
	var change *string
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT unapplied_change FROM ingestion_external_record WHERE external_id = 'card-1'`).Scan(&change); err != nil {
		t.Fatal(err)
	}
	if change == nil || *change == "" {
		t.Fatal("the record keeps no trace of the provider's change")
	}
	if b := f.batches(card)[0]; b.Counts.Updated != 1 {
		t.Fatalf("batch = %+v", b)
	}
}

// A42: an aggregator balance never records yield, even on a reserve with yield mode auto.
func TestSyncBalanceRecordsNoYield(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	reserve := f.h.Account("Caixinha", "asset", "reserve", nil)
	f.h.Record("2026-10-02", apitest.Posting(f.checking, -5000), apitest.Posting(reserve, 5000))
	f.mapTo(pluggy.SubtypeSavings, reserve)
	f.sync()
	if b := f.batches(reserve)[0]; b.Balance.Status != "recorded" || b.Balance.Amount.Amount != 10000 {
		t.Fatalf("batch = %+v", b)
	}
	if n := f.count(`SELECT count(*) FROM ledger_posting WHERE account_id = $1`, reserve); n != 1 {
		t.Fatalf("reserve postings = %d; no yield may be recorded", n)
	}
	if n := f.count(`SELECT count(*) FROM ledger_reconciliation WHERE account_id = $1`, reserve); n != 0 {
		t.Fatalf("reconciliations = %d; the difference stays open", n)
	}
	if n := f.count(`SELECT count(*) FROM ledger_balance_assertion WHERE account_id = $1 AND source = 'aggregator'`, reserve); n != 1 {
		t.Fatalf("assertions = %d", n)
	}
}

type assertionView struct {
	Reconciled bool   `json:"reconciled"`
	Date       string `json:"date"`
	Amount     struct {
		Amount int64 `json:"amount"`
	} `json:"amount"`
	Source string `json:"source"`
}

func (f syncFixture) assertions(account string) []assertionView {
	f.h.T().Helper()
	var out struct {
		Items []assertionView `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+account+"/balance-assertions", nil, http.StatusOK, &out)
	return out.Items
}

func (f syncFixture) recordOpeningBalance(account string, amount int64) {
	f.h.T().Helper()
	var accounts struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)
	for _, a := range accounts.Items {
		if a.SystemRole == "opening_balances" {
			f.h.Record("2026-10-31", apitest.Posting(account, amount), apitest.Posting(a.ID, -amount))
			return
		}
	}
	f.h.T().Fatal("no opening balances account")
}

func (f syncFixture) openDifference(account string) any {
	f.h.T().Helper()
	var out struct {
		OpenDifference any `json:"open_difference"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+account+"/reconciliation", nil, http.StatusOK, &out)
	return out.OpenDifference
}

// S71: a synced assertion left open by a missing opening balance is decided again by the
// next sync, which creates no assertion (D5, A77).
func TestS71SyncReevaluatesOpenAssertion(t *testing.T) {
	t.Parallel()
	setup := func(t *testing.T) syncFixture {
		f := newSyncFixture(t)
		f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-05", "-45.90"))
		f.line(pluggy.SubtypeChecking, bankLine("tx-2", "2026-10-12", "-120.00"))
		f.line(pluggy.SubtypeChecking, bankLine("tx-3", "2026-10-15", "3000.00"))
		f.p.SetAccountBalance(nubankItem+"-checking", "3834.10")
		f.mapTo(pluggy.SubtypeChecking, f.checking)
		return f
	}

	t.Run("repeated sync", func(t *testing.T) {
		f := setup(t)
		f.sync()
		got := f.assertions(f.checking)
		if len(got) != 1 || got[0].Reconciled || got[0].Source != "aggregator" || got[0].Date != "2026-11-12" || got[0].Amount.Amount != 383410 {
			t.Fatalf("assertions after the first sync = %+v", got)
		}
		if f.openDifference(f.checking) == nil {
			t.Fatal("the first sync must leave a difference open")
		}

		f.recordOpeningBalance(f.checking, 100000)
		f.sync()
		got = f.assertions(f.checking)
		if len(got) != 1 || !got[0].Reconciled {
			t.Fatalf("assertions after the second sync = %+v", got)
		}
		if d := f.openDifference(f.checking); d != nil {
			t.Fatalf("open difference = %v", d)
		}
		if n := f.count(`SELECT count(*) FROM ledger_reconciliation WHERE account_id = $1 AND resolution = 'none' AND difference = 0`, f.checking); n != 1 {
			t.Fatalf("reconciliations = %d", n)
		}
	})

	t.Run("second assertion through the API", func(t *testing.T) {
		f := setup(t)
		f.sync()
		body := map[string]any{"date": "2026-11-12", "amount": apitest.BRL(383410), "source": "aggregator"}
		post := func(wantResolution string) {
			t.Helper()
			var out struct {
				Resolution string `json:"resolution"`
			}
			f.h.MustDo(http.MethodPost, "/api/v1/accounts/"+f.checking+"/balance-assertions", body, http.StatusCreated, &out)
			if out.Resolution != wantResolution {
				t.Fatalf("resolution = %q, want %q", out.Resolution, wantResolution)
			}
		}
		post("")
		f.recordOpeningBalance(f.checking, 100000)
		post("none")
		f.sync()
		got := f.assertions(f.checking)
		if len(got) != 3 {
			t.Fatalf("assertions = %+v", got)
		}
		for _, a := range got {
			if !a.Reconciled {
				t.Fatalf("assertions = %+v; all must be reconciled", got)
			}
		}
	})
}
