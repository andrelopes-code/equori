package ingestion_test

import (
	"errors"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/apitest"
	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

const notGrantedLocks = `SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted
	AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`

const (
	holderCPF       = "529.982.247-25"
	holderDigestHex = "79356df8292712e305b550373e815f99f39284e6fb35d701f636add4e2a71678"
	thirdPartyCPF   = "111.444.777-35"
	maskedCPF       = "***.982.247-**"

	thirdPartyDigestHex = "91fe97f78ba094ba595018b806102a0f3656f689d9a414c33889f035d5681409"
)

// A217: both checking accounts store the digest of their holder; the card account stores none.
func TestHolderDigestStored(t *testing.T) {
	t.Parallel()

	f := newPairingFixture(t)
	f.sync(f.nubank)
	f.sync(f.mercadoPago)

	for _, c := range []connectionView{f.nubank, f.mercadoPago} {
		for subtype, want := range map[string]string{pluggy.SubtypeChecking: holderDigestHex, pluggy.SubtypeCard: ""} {
			if got := f.holderDigest(c.ID, subtype); got != want {
				t.Errorf("%s %s holder_digest = %q, want %q", c.ID, subtype, got, want)
			}
		}
	}
}

// A217 rule 1: a listing that reports a holder replaces the stored digest; one without keeps it.
func TestHolderReportedAgain(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		taxNumber string
		want      string
	}{
		{"another holder", thirdPartyCPF, thirdPartyDigestHex},
		{"no holder", "", holderDigestHex},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newPairingFixture(t)
			f.sync(f.nubank)

			f.p.SetAccountTaxNumber(nubankItem+"-checking", tt.taxNumber)
			f.p.SetItemUpdatedAt(nubankItem, "2026-11-12T07:00:00.000Z")
			f.sync(f.nubank)

			if got := f.holderDigest(f.nubank.ID, pluggy.SubtypeChecking); got != tt.want {
				t.Fatalf("holder_digest = %q, want %q", got, tt.want)
			}
		})
	}
}

// A217 rule 4: the counterparty of a line against the holders of the book.
func TestCounterpartyAtImport(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		line pluggy.Transaction
		want string
	}{
		{"receiver holder", pixLine("cp-holder", "2026-11-05", "-10.00", cpf(holderCPF)), "holder"},
		{"payer third party", pixLine("cp-third", "2026-11-06", "20.00", cpf(thirdPartyCPF)), "third_party"},
		{"payer masked", pixLine("cp-masked", "2026-11-07", "30.00", cpf(maskedCPF)), ""},
		{"no payment data", bankLine("cp-none", "2026-11-08", "-40.00"), ""},
	}

	f := newPairingFixture(t)
	for _, tt := range tests {
		f.p.AddTransaction(nubankItem+"-checking", tt.line)
	}

	f.sync(f.nubank)

	for _, tt := range tests {
		if got := f.counterparty(tt.line.ID); got != tt.want {
			t.Errorf("%s: counterparty = %q, want %q", tt.name, got, tt.want)
		}
	}
}

// A217 rule 4, shared book: the holder of another mapped account counts as a holder.
func TestCounterpartyOfAnotherHolder(t *testing.T) {
	t.Parallel()

	f := newPairingFixtureOf(t, thirdPartyCPF, true)
	f.p.AddTransaction(nubankItem+"-checking", pixLine("cp-other", "2026-11-05", "-10.00", cpf(thirdPartyCPF)))
	f.sync(f.nubank)

	if got := f.counterparty("cp-other"); got != "holder" {
		t.Fatalf("counterparty = %q, want holder", got)
	}
}

// A217 rule 4: a stored counterparty is not revised when a holder is mapped later.
func TestCounterpartyNotRevised(t *testing.T) {
	t.Parallel()

	f := newPairingFixtureOf(t, thirdPartyCPF, false)
	f.p.AddTransaction(nubankItem+"-checking", pixLine("cp-late", "2026-11-05", "10.00", cpf(thirdPartyCPF)))
	f.sync(f.nubank)

	if got := f.counterparty("cp-late"); got != "third_party" {
		t.Fatalf("counterparty before mapping = %q, want third_party", got)
	}

	ext := externalAccount(f.mercadoPago, pluggy.SubtypeChecking)
	body := map[string]any{"account_id": f.mpLedger, "sync_from": "2026-10-01"}

	if r := f.mapAccount(f.h.Client, f.mercadoPago.ID, ext.ID, body); r.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", r.Status, r.Body)
	}

	f.p.SetItemUpdatedAt(nubankItem, "2026-11-12T07:00:00.000Z")
	f.sync(f.nubank)

	if got := f.counterparty("cp-late"); got != "third_party" {
		t.Fatalf("counterparty after mapping = %q, want third_party", got)
	}
}

// S358: a line whose counterparty is a third party pairs with no transaction, with or without a
// counterpart of the same amount.
func TestS358ThirdParty(t *testing.T) {
	t.Parallel()

	f := newPairingFixture(t)
	f.mpLine(bankLine("mp-in-90", "2026-11-08", "90.00"))
	f.mpLine(bankLine("mp-out-60", "2026-11-05", "-60.00"))
	f.sync(f.mercadoPago)

	f.nubankLine(pixLine("nu-out-90", "2026-11-08", "-90.00", cpf(thirdPartyCPF)))
	f.nubankLine(pixLine("nu-in-60", "2026-11-08", "60.00", cpf(thirdPartyCPF)))
	f.sync(f.nubank)

	out := f.record("nu-out-90")
	if out.State != "created" {
		t.Fatalf("nu-out-90 = %+v, want created", out)
	}

	wantOut := map[string]int64{"Nubank": -9000, "uncategorized_expense": 9000}
	if got := f.legs(out.Tx); !maps.Equal(got, wantOut) {
		t.Errorf("nu-out-90 postings = %v, want %v", got, wantOut)
	}

	in := f.record("nu-in-60")
	if in.State != "created" {
		t.Fatalf("nu-in-60 = %+v, want created", in)
	}

	wantIn := map[string]int64{"Nubank": 6000, "uncategorized_income": -6000}
	if got := f.legs(in.Tx); !maps.Equal(got, wantIn) {
		t.Errorf("nu-in-60 postings = %v, want %v", got, wantIn)
	}

	if n := f.scalar(`SELECT count(*) FROM ingestion_external_record WHERE state = 'needs_review'`); n != 0 {
		t.Errorf("records in review = %d, want 0", n)
	}
}

// S361: without a document the line waits in review with the transaction as its candidate, in a
// region that no default names as in the default one.
func TestS361NoDocument(t *testing.T) {
	t.Parallel()

	profiles := map[string][]apitest.Option{
		"default": nil,
		"neutral": {apitest.As(apitest.Neutral())},
	}

	for name, opts := range profiles {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newPairingFixture(t, opts...)
			f.nubankLine(bankLine("nu-out-40", "2026-11-09", "-40.00"))
			f.sync(f.nubank)

			f.mpLine(bankLine("mp-in-40", "2026-11-10", "40.00"))
			f.sync(f.mercadoPago)

			want := recordRow{State: "needs_review", Reason: "transfer", Candidates: []string{f.record("nu-out-40").Tx}}
			if got := f.record("mp-in-40"); !got.equal(want) {
				t.Fatalf("mp-in-40 = %+v, want %+v", got, want)
			}
		})
	}
}

// S362: two counterparts in the window are both candidates, by date.
func TestS362SeveralCounterparts(t *testing.T) {
	t.Parallel()

	f := newPairingFixture(t)
	f.nubankLine(bankLine("nu-a", "2026-11-09", "-100.00"))
	f.nubankLine(bankLine("nu-b", "2026-11-11", "-100.00"))
	f.sync(f.nubank)

	f.mpLine(pixLine("mp-in-100", "2026-11-10", "100.00", cpf(holderCPF)))
	f.sync(f.mercadoPago)

	want := recordRow{State: "needs_review", Reason: "transfer", Candidates: []string{f.record("nu-a").Tx, f.record("nu-b").Tx}}
	if got := f.record("mp-in-100"); !got.equal(want) {
		t.Fatalf("mp-in-100 = %+v, want %+v", got, want)
	}

	if b := f.batchOf(f.mpLedger); b.Counts.NeedsReview != 1 || b.Counts.Paired != 0 {
		t.Errorf("Mercado Pago counts = %+v, want needs_review 1 paired 0", b.Counts)
	}
}

// S363: a rule of the owner and a posting that takes the line by zone link come before pairing.
func TestS363Precedence(t *testing.T) {
	t.Parallel()

	f := newPairingFixture(t)
	gifts := f.h.Account("Gifts", "income", "", nil)
	salary := f.h.Account("Salary", "income", "", nil)
	manual := f.h.Record("2026-11-10", f.h.Posting(f.nubankLedger, 12000), f.h.Posting(salary, -12000))

	f.h.MustDo(http.MethodPost, "/api/v1/rules", map[string]any{
		"name":       "Received transfer",
		"conditions": []any{map[string]any{"field": "description", "operator": "contains", "value": "Transferência recebida"}},
		"actions":    []any{map[string]any{"type": "set_category", "category_id": gifts}},
	}, http.StatusCreated, nil)

	f.mpLine(pixLine("mp-out-250", "2026-11-10", "-250.00", cpf(holderCPF)))
	f.mpLine(bankLine("mp-out-120", "2026-11-10", "-120.00"))
	f.sync(f.mercadoPago)

	ruled := pixLine("nu-in-250", "2026-11-10", "250.00", cpf(holderCPF))
	ruled.Description = "Transferência recebida"
	f.nubankLine(ruled)
	f.nubankLine(pixLine("nu-in-120", "2026-11-10", "120.00", cpf(holderCPF)))
	f.sync(f.nubank)

	if mp := f.record("mp-out-250"); !mp.equal(recordRow{State: "needs_review", Reason: "transfer"}) {
		t.Errorf("mp-out-250 = %+v, want needs_review transfer without candidates", mp)
	}

	nu := f.record("nu-in-250")
	if nu.State != "created" {
		t.Fatalf("nu-in-250 = %+v, want created", nu)
	}

	if got, want := f.legs(nu.Tx), map[string]int64{"Nubank": 25000, "Gifts": -25000}; !maps.Equal(got, want) {
		t.Errorf("nu-in-250 postings = %v, want %v", got, want)
	}

	if linked := f.record("nu-in-120"); linked.State != "matched" || linked.Decision != "linked" || linked.Tx != manual {
		t.Errorf("nu-in-120 = %+v, want matched linked to %s", linked, manual)
	}
}

// S364: a counterpart 3 days away pairs, 4 days away or of another amount waits in review, and a
// pending line is no record.
func TestS364Bounds(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		mpDate  string
		amount  pluggy.Decimal
		pending bool
		want    recordRow
	}{
		{"three days", "2026-11-07", "250.00", false, recordRow{State: "matched", Decision: "paired"}},
		{"four days", "2026-11-06", "250.00", false, recordRow{State: "needs_review", Reason: "transfer"}},
		{"another amount", "2026-11-07", "250.01", false, recordRow{State: "needs_review", Reason: "transfer"}},
		{"pending line", "2026-11-07", "250.00", true, recordRow{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newPairingFixture(t)
			f.mpLine(pixLine("mp-out", tt.mpDate, "-250.00", cpf(holderCPF)))
			f.sync(f.mercadoPago)
			f.resolve("mp-out", map[string]any{"action": "create"})

			line := pixLine("nu-in", "2026-11-10", tt.amount, cpf(holderCPF))
			if tt.pending {
				line.Status = "PENDING"
			}

			f.nubankLine(line)
			f.sync(f.nubank)

			got := f.record("nu-in")
			if tt.want.State == "matched" {
				tt.want.Tx = f.record("mp-out").Tx
			}

			if !got.equal(tt.want) {
				t.Fatalf("nu-in = %+v, want %+v", got, tt.want)
			}
		})
	}
}

// A218 row 3 and A220: a holder line without counterpart waits; the owner books it; the line of the
// other account then pairs with that transaction.
func TestPairWithTransaction(t *testing.T) {
	t.Parallel()

	f := newPairingFixture(t)
	f.mpLine(pixLine("mp-out", "2026-11-10", "-250.00", cpf(holderCPF)))
	f.sync(f.mercadoPago)

	if mp := f.record("mp-out"); !mp.equal(recordRow{State: "needs_review", Reason: "transfer"}) {
		t.Fatalf("mp-out = %+v, want needs_review transfer without candidates", mp)
	}

	f.resolve("mp-out", map[string]any{"action": "create"})
	booked := f.record("mp-out").Tx

	f.nubankLine(pixLine("nu-in", "2026-11-10", "250.00", cpf(holderCPF)))
	f.sync(f.nubank)

	if nu := f.record("nu-in"); nu.State != "matched" || nu.Decision != "paired" || nu.Tx != booked {
		t.Fatalf("nu-in = %+v, want matched paired with %s", nu, booked)
	}

	if b := f.batchOf(f.nubankLedger); b.Counts.Paired != 1 || b.Counts.Created != 0 {
		t.Errorf("Nubank counts = %+v, want paired 1 created 0", b.Counts)
	}

	tx := f.h.Transaction(booked)
	if tx.Version != 2 {
		t.Errorf("version = %d, want 2", tx.Version)
	}

	if got, want := f.legs(booked), map[string]int64{"Mercado Pago": -25000, "Nubank": 25000}; !maps.Equal(got, want) {
		t.Errorf("postings = %v, want %v", got, want)
	}
}

// A218 rule 3: a sync of the book waits while another holds the book's pairing lock.
func TestBookPairingLock(t *testing.T) {
	t.Parallel()

	f := newPairingFixture(t)
	f.nubankLine(bankLine("nu-out", "2026-11-09", "-40.00"))

	ctx := t.Context()

	conn, err := f.h.Pool.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()

	lock := fmt.Sprintf("books:%d:pairing", f.h.OwnerID())
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(hashtextextended($1::text, 0))`, lock); err != nil {
		t.Fatal(err)
	}

	unlocked := false

	unlock := func() {
		if !unlocked {
			unlocked = true

			_, _ = conn.Exec(ctx, `SELECT pg_advisory_unlock(hashtextextended($1::text, 0))`, lock)
		}
	}
	defer unlock()

	done := make(chan error, 1)

	go func() {
		done <- f.h.App.Ingestion.SyncConnection(ctx, f.h.OwnerID(), uuid.MustParse(f.nubank.ID))
	}()

	deadline := time.Now().Add(10 * time.Second)
	for f.scalar(notGrantedLocks) == 0 {
		select {
		case err := <-done:
			t.Fatalf("sync ended while the book lock was held: %v", err)
		default:
		}

		if time.Now().After(deadline) {
			t.Fatal("no sync waited for the book lock")
		}

		time.Sleep(10 * time.Millisecond)
	}

	unlock()

	if err := <-done; err != nil {
		t.Fatalf("sync: %v", err)
	}

	if b := f.batchOf(f.nubankLedger); b.Counts.Created != 1 {
		t.Errorf("Nubank counts = %+v, want created 1", b.Counts)
	}
}

type pairingFixture struct {
	aggregator

	nubank      connectionView
	mercadoPago connectionView

	nubankLedger string
	cardLedger   string
	mpLedger     string
}

func newPairingFixture(t *testing.T, opts ...apitest.Option) pairingFixture {
	return newPairingFixtureOf(t, holderCPF, true, opts...)
}

// newPairingFixtureOf sets the holder the Mercado Pago checking account reports and whether
// the fixture maps it.
func newPairingFixtureOf(t *testing.T, mpHolder string, mapMP bool, opts ...apitest.Option) pairingFixture {
	t.Helper()

	a := newAggregator(t, opts...)
	base := string(a.h.Profile.Base)
	a.serveItemIn(pluggyClient, nubankItem, "Nubank", base)
	a.serveItemIn(pluggyClient, mercadoPagoItem, "Mercado Pago", base)
	a.p.SetAccountTaxNumber(nubankItem+"-checking", holderCPF)
	a.p.SetAccountTaxNumber(mercadoPagoItem+"-checking", mpHolder)
	a.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-nov", DueDate: "2026-11-10T00:00:00.000Z", TotalAmount: "0"})

	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	f := pairingFixture{
		aggregator:  a,
		nubank:      a.mustConnect(a.h.Client, in.ID, nubankItem),
		mercadoPago: a.mustConnect(a.h.Client, in.ID, mercadoPagoItem),
	}

	f.nubankLedger = a.h.Account("Nubank", "asset", "checking", nil)
	f.cardLedger = a.h.Account("Nubank Gold", "liability", "credit_card", nil)
	f.mpLedger = a.h.Account("Mercado Pago", "asset", "checking", nil)
	a.h.MustDo(http.MethodPost, "/api/v1/accounts/"+f.cardLedger+"/billing-cycle-rules", map[string]any{
		"effective_from": "2026-01", "closing_day": 3, "due_day": 10, "closing_day_assignment": "next",
	}, http.StatusCreated, nil)

	f.mapTo(f.nubank, pluggy.SubtypeChecking, f.nubankLedger)
	f.mapTo(f.nubank, pluggy.SubtypeCard, f.cardLedger)

	if mapMP {
		f.mapTo(f.mercadoPago, pluggy.SubtypeChecking, f.mpLedger)
	}

	return f
}

func (f pairingFixture) mapTo(c connectionView, subtype, account string) {
	f.h.T().Helper()

	body := map[string]any{"account_id": account, "sync_from": "2026-10-01"}
	if r := f.mapAccount(f.h.Client, c.ID, externalAccount(c, subtype).ID, body); r.Status != http.StatusOK {
		f.h.T().Fatalf("map status %d: %s", r.Status, r.Body)
	}
}

func (f pairingFixture) sync(c connectionView) {
	f.h.T().Helper()

	if err := f.h.App.Ingestion.SyncConnection(f.h.T().Context(), f.h.OwnerID(), uuid.MustParse(c.ID)); err != nil {
		f.h.T().Fatalf("sync: %v", err)
	}
}

// holderDigest returns the hex digest stored for the account of a connection; "" when null.
func (f pairingFixture) holderDigest(connectionID, subtype string) string {
	f.h.T().Helper()

	var digest *string

	err := f.h.Pool.QueryRow(f.h.T().Context(),
		`SELECT encode(holder_digest, 'hex') FROM ingestion_external_account WHERE connection_id = $1 AND subtype = $2`,
		connectionID, subtype).Scan(&digest)
	if err != nil {
		f.h.T().Fatal(err)
	}

	if digest == nil {
		return ""
	}

	return *digest
}

// counterparty returns the stored counterparty of a record; "" when null.
func (f pairingFixture) counterparty(externalID string) string {
	f.h.T().Helper()

	var cp *string

	err := f.h.Pool.QueryRow(f.h.T().Context(),
		`SELECT counterparty FROM ingestion_external_record WHERE external_id = $1`, externalID).Scan(&cp)
	if err != nil {
		f.h.T().Fatal(err)
	}

	if cp == nil {
		return ""
	}

	return *cp
}

func cpf(value string) *pluggy.DocumentNumber {
	return &pluggy.DocumentNumber{Type: "CPF", Value: value}
}

// pixLine builds a bank line whose receiver (amount below zero) or payer (above zero) is party.
func pixLine(id, date string, amount pluggy.Decimal, party *pluggy.DocumentNumber) pluggy.Transaction {
	line := bankLine(id, date, amount)
	pd := &pluggy.PaymentData{}

	if strings.HasPrefix(string(amount), "-") {
		pd.Receiver = &pluggy.PaymentParty{DocumentNumber: party}
	} else {
		pd.Payer = &pluggy.PaymentParty{DocumentNumber: party}
	}

	line.PaymentData = pd

	return line
}

// recordRow is the stored outcome of a record.
type recordRow struct {
	State, Reason, Decision, Tx string
	Candidates                  []string
}

func (r recordRow) equal(o recordRow) bool {
	return r.State == o.State && r.Reason == o.Reason && r.Decision == o.Decision && r.Tx == o.Tx &&
		slices.Equal(r.Candidates, o.Candidates)
}

func (f pairingFixture) nubankLine(l pluggy.Transaction) {
	l.CurrencyCode = string(f.h.Profile.Base)
	f.p.AddTransaction(nubankItem+"-checking", l)
}

func (f pairingFixture) mpLine(l pluggy.Transaction) {
	l.CurrencyCode = string(f.h.Profile.Base)
	f.p.AddTransaction(mercadoPagoItem+"-checking", l)
}

// record returns the stored outcome of a line; the zero value when the line has no record.
func (f pairingFixture) record(externalID string) recordRow {
	f.h.T().Helper()

	var (
		r          recordRow
		candidates string
	)

	err := f.h.Pool.QueryRow(f.h.T().Context(),
		`SELECT state, COALESCE(review_reason, ''), COALESCE(decision, ''), COALESCE(transaction_id::text, ''),
			array_to_string(candidates, ',') FROM ingestion_external_record WHERE external_id = $1`,
		externalID).Scan(&r.State, &r.Reason, &r.Decision, &r.Tx, &candidates)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return recordRow{}
		}

		f.h.T().Fatal(err)
	}

	if candidates != "" {
		r.Candidates = strings.Split(candidates, ",")
	}

	return r
}

// legs returns the posting amounts of a transaction by account name, or system role.
func (f pairingFixture) legs(tx string) map[string]int64 {
	f.h.T().Helper()

	out := map[string]int64{}

	for _, p := range f.h.Transaction(tx).Postings {
		var name string

		err := f.h.Pool.QueryRow(f.h.T().Context(),
			`SELECT COALESCE(system_role, name) FROM ledger_account WHERE id = $1`, p.AccountID).Scan(&name)
		if err != nil {
			f.h.T().Fatal(err)
		}

		out[name] += p.Amount.Amount
	}

	return out
}

func (f pairingFixture) scalar(sql string, args ...any) int {
	f.h.T().Helper()

	var n int
	if err := f.h.Pool.QueryRow(f.h.T().Context(), sql, args...).Scan(&n); err != nil {
		f.h.T().Fatal(err)
	}

	return n
}

// batchOf returns the newest aggregator batch of a ledger account.
func (f pairingFixture) batchOf(account string) syncBatch {
	f.h.T().Helper()

	var out struct {
		Items []syncBatch `json:"items"`
	}

	f.h.MustDo(http.MethodGet, "/api/v1/import-batches", nil, http.StatusOK, &out)

	for _, b := range out.Items {
		if b.AccountID == account {
			return b
		}
	}

	f.h.T().Fatalf("no batch of account %s", account)

	return syncBatch{}
}

func (f pairingFixture) resolve(externalID string, body map[string]any) {
	f.h.T().Helper()

	id := f.scalarText(`SELECT id::text FROM ingestion_external_record WHERE external_id = $1`, externalID)
	f.h.MustDo(http.MethodPost, "/api/v1/external-records/"+id+"/resolve", body, http.StatusOK, nil)
}

func (f pairingFixture) scalarText(sql string, args ...any) string {
	f.h.T().Helper()

	var s string
	if err := f.h.Pool.QueryRow(f.h.T().Context(), sql, args...).Scan(&s); err != nil {
		f.h.T().Fatal(err)
	}

	return s
}
