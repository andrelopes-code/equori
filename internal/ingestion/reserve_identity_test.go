package ingestion_test

import (
	"maps"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

// S340 (A212): a reserve line naming a mapped reserve in another case, spacing or Unicode form
// books a transfer.
func TestS340ReserveNameSpellings(t *testing.T) {
	t.Parallel()

	r := newReserveFixture(t, "Coração")
	lines := map[string]string{
		"s340-exact":   "Dinheiro reservado Coração",
		"s340-case":    "Dinheiro reservado coração",
		"s340-spaces":  "Dinheiro  reservado   Coração ",
		"s340-unicode": "Dinheiro reservado Coração",
		"s340-wording": "DINHEIRO RESERVADO Coração",
	}

	for id, description := range lines {
		r.p.AddTransaction(r.checkingID, reserveLine(id, "2026-11-12", description, "-1.00"))
	}

	r.syncAt("2026-11-12T15:00:00.000Z")

	want := map[string]int64{r.checking: -100, r.reserves["Coração"]: 100}
	for id := range lines {
		if got := r.postings(id); !maps.Equal(got, want) {
			t.Fatalf("postings of %s = %v, want %v", id, got, want)
		}
	}
}

// S341 (A212): a new pending or ignored reserve holds the former name of a mapped reserve: a
// line inside its window waits, a line after it is ordinary, and the mapped reserve receives
// neither.
func TestS341UnmappedReserveHoldsFormerName(t *testing.T) {
	t.Parallel()

	for _, ignored := range []bool{false, true} {
		r := newReserveFixture(t, "Viagem")
		reserve := r.reserves["Viagem"]
		r.p.RenameReservedBalance(r.checkingID, "res-Viagem", "Casa")
		r.p.AddReservedBalance(r.checkingID, reserved("Viagem", "res-new", "40.00"))
		r.p.AddTransaction(r.checkingID, reserveLine("s341-window", "2026-11-12", "Dinheiro reservado Viagem", "-40.00"))
		r.syncAt("2026-11-12T15:00:00.000Z")

		r.wantReview("s341-window", "reserve")

		if ignored {
			conn := r.connection(r.h.Client, r.conn.ID)
			if m := r.mapAccount(r.h.Client, r.conn.ID, reservedByName(conn, "Viagem").ID, map[string]any{"ignored": true}); m.Status != http.StatusOK {
				t.Fatalf("ignore status %d: %s", m.Status, m.Body)
			}
		}

		r.setToday("2026-11-13")
		r.p.AddTransaction(r.checkingID, reserveLine("s341-after", "2026-11-13", "Dinheiro reservado Viagem", "-5.00"))
		r.syncAt("2026-11-13T15:00:00.000Z")

		if got := r.postings("s341-after"); got[reserve] != 0 || got[r.checking] != -500 {
			t.Fatalf("postings after the window = %v, want none on the reserve", got)
		}
	}
}

// S342 (A212): a line dated before the new holder's window goes to the former holder, one
// inside it waits, and one after it goes to the holder.
func TestS342NameWindow(t *testing.T) {
	t.Parallel()

	r := newReserveFixture(t, "Viagem")
	house := r.reserves["Viagem"]
	r.setToday("2026-11-13")
	r.p.RenameReservedBalance(r.checkingID, "res-Viagem", "Casa")
	r.p.AddReservedBalance(r.checkingID, reserved("Viagem", "res-new", "0.00"))
	r.syncAt("2026-11-13T15:00:00.000Z")

	trip := r.h.Account("MP Viagem nova", "asset", "reserve", nil)
	conn := r.connection(r.h.Client, r.conn.ID)

	body := map[string]any{"account_id": trip, "sync_from": "2026-11-11"}
	if m := r.mapAccount(r.h.Client, r.conn.ID, reservedByName(conn, "Viagem").ID, body); m.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", m.Status, m.Body)
	}

	r.setToday("2026-11-14")
	r.p.AddTransaction(r.checkingID, reserveLine("s342-before", "2026-11-11", "Dinheiro reservado Viagem", "-1.00"))
	r.p.AddTransaction(r.checkingID, reserveLine("s342-inside", "2026-11-13", "Dinheiro reservado Viagem", "-2.00"))
	r.p.AddTransaction(r.checkingID, reserveLine("s342-after", "2026-11-14", "Dinheiro reservado Viagem", "-3.00"))
	r.syncAt("2026-11-14T15:00:00.000Z")

	if got, want := r.postings("s342-before"), (map[string]int64{r.checking: -100, house: 100}); !maps.Equal(got, want) {
		t.Fatalf("line before the window = %v, want %v", got, want)
	}

	r.wantReview("s342-inside", "reserve")

	if got, want := r.postings("s342-after"), (map[string]int64{r.checking: -300, trip: 300}); !maps.Equal(got, want) {
		t.Fatalf("line after the window = %v, want %v", got, want)
	}
}

// S343 (A213): an unrecognized reserve line within the yield bound waits, the reserve books no
// yield and the difference stays open; once the owner records the transfer, a later sync
// reconciles the assertion without yield.
func TestS343UnresolvedLineBooksNoYield(t *testing.T) {
	t.Parallel()

	f, reserve, checkingID := reserveAfterFirstSync(t, "auto")
	checking := f.h.Account("Mercado Pago", "asset", "checking", nil)
	f.h.Record("2026-10-31", apitest.Posting(checking, 100000), apitest.Posting(openingBalances(f), -100000))

	body := map[string]any{"account_id": checking, "sync_from": "2026-11-01"}
	if m := f.mapAccount(f.h.Client, f.conn.ID, externalAccount(f.conn, pluggy.SubtypeChecking).ID, body); m.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", m.Status, m.Body)
	}

	// B = floor(100292 * 3 * 1 / 3000) = 100; 60 is within it.
	f.p.AddTransaction(checkingID, reserveLine("s343", "2026-11-11", "Dinheiro reservado Nome Nunca Visto", "-0.60"))
	f.syncReserve(checkingID, "2026-11-11", "1003.52")

	if state, _ := f.recordOf("s343"); state != "needs_review" {
		t.Fatalf("state = %s, want needs_review", state)
	}

	if y := f.yieldTransactions(reserve); len(y) != 0 {
		t.Fatalf("yields = %+v, want none", y)
	}

	if diff, open := f.reserveDifference(reserve); !open || diff != 60 {
		t.Fatalf("open difference = %d, %v, want 60", diff, open)
	}

	var record string
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT id::text FROM ingestion_external_record WHERE external_id = 's343'`).Scan(&record); err != nil {
		t.Fatal(err)
	}

	f.h.MustDo(http.MethodPost, "/api/v1/external-records/"+record+"/resolve", map[string]any{"action": "create"}, http.StatusOK, nil)

	_, tx := f.recordOf("s343")
	f.h.MustDo(http.MethodPost, "/api/v1/transactions/"+tx+"/transfer", map[string]any{"expected_version": 1, "account_id": reserve}, http.StatusOK, nil)
	f.syncReserve(checkingID, "2026-11-11", "1003.52")

	if y := f.yieldTransactions(reserve); len(y) != 0 {
		t.Fatalf("yields after the transfer = %+v, want none", y)
	}

	if diff, open := f.reserveDifference(reserve); open {
		t.Fatalf("open difference after the transfer = %d", diff)
	}
}

// A213: with no line waiting, the difference of the open assertion is decided as yield again.
func TestDiscardedReserveLineReleasesYield(t *testing.T) {
	t.Parallel()

	f, reserve, checkingID := reserveAfterFirstSync(t, "auto")
	checking := f.h.Account("Mercado Pago", "asset", "checking", nil)
	f.h.Record("2026-10-31", apitest.Posting(checking, 100000), apitest.Posting(openingBalances(f), -100000))

	body := map[string]any{"account_id": checking, "sync_from": "2026-11-01"}
	if m := f.mapAccount(f.h.Client, f.conn.ID, externalAccount(f.conn, pluggy.SubtypeChecking).ID, body); m.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", m.Status, m.Body)
	}

	f.p.AddTransaction(checkingID, reserveLine("released", "2026-11-11", "Dinheiro reservado Nome Nunca Visto", "-0.60"))
	f.syncReserve(checkingID, "2026-11-11", "1003.52")

	var record string
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT id::text FROM ingestion_external_record WHERE external_id = 'released'`).Scan(&record); err != nil {
		t.Fatal(err)
	}

	f.h.MustDo(http.MethodPost, "/api/v1/external-records/"+record+"/resolve", map[string]any{"action": "discard"}, http.StatusOK, nil)
	f.syncReserve(checkingID, "2026-11-11", "1003.52")

	wantYield(t, f, reserve, "Rendimento de 11/11/2026", 60)
}

type reserveFixture struct {
	syncFixture
	today      *atomic.Pointer[time.Time]
	checkingID string
	checking   string
	reserves   map[string]string
}

// newReserveFixture maps a checking account from 2026-11-01 and each named reserve from
// 2026-11-11, and syncs once on 2026-11-12.
func newReserveFixture(t *testing.T, names ...string) reserveFixture {
	t.Helper()

	today := &atomic.Pointer[time.Time]{}
	a := newAggregator(t, apitest.Clock(func() time.Time { return *today.Load() }))
	r := reserveFixture{today: today, checkingID: mercadoPagoItem + "-checking", reserves: map[string]string{}}
	r.setToday("2026-11-12")

	it := pluggy.Item{ID: mercadoPagoItem, Status: pluggy.StatusUpdated, LastUpdatedAt: new("2026-11-11T15:00:00.000Z")}
	it.Connector.Name = "Mercado Pago"
	a.p.AddItemTo(pluggyClient, it)
	a.p.AddAccount(mercadoPagoItem, pluggy.Account{
		ID: r.checkingID, Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Mercado Pago",
		Number: checkingNumber, Balance: "500.05", CurrencyCode: "BRL",
	})

	for _, name := range names {
		a.p.AddReservedBalance(r.checkingID, reserved(name, "res-"+name, "0.00"))
	}

	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	r.syncFixture = syncFixture{aggregator: a, conn: a.mustConnect(a.h.Client, in.ID, mercadoPagoItem)}
	r.checking = a.h.Account("Mercado Pago", "asset", "checking", nil)
	a.h.Record("2026-10-31", apitest.Posting(r.checking, 100000), apitest.Posting(openingBalances(r.syncFixture), -100000))

	external := externalAccount(r.conn, pluggy.SubtypeChecking).ID
	if m := a.mapAccount(a.h.Client, r.conn.ID, external, map[string]any{"account_id": r.checking, "sync_from": "2026-11-01"}); m.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", m.Status, m.Body)
	}

	for _, name := range names {
		r.reserves[name] = a.h.Account("MP "+name, "asset", "reserve", nil)

		body := map[string]any{"account_id": r.reserves[name], "sync_from": "2026-11-11"}
		if m := a.mapAccount(a.h.Client, r.conn.ID, reservedByName(r.conn, name).ID, body); m.Status != http.StatusOK {
			t.Fatalf("map status %d: %s", m.Status, m.Body)
		}
	}

	r.sync()

	return r
}

func (r reserveFixture) setToday(date string) {
	d, err := time.Parse(time.DateOnly, date)
	if err != nil {
		panic(err)
	}

	d = d.Add(18 * time.Hour)
	r.today.Store(&d)
}

func (r reserveFixture) syncAt(updatedAt string) {
	r.h.T().Helper()
	r.p.SetItemUpdatedAt(mercadoPagoItem, updatedAt)
	r.sync()
}

func (r reserveFixture) postings(externalID string) map[string]int64 {
	r.h.T().Helper()

	state, tx := r.recordOf(externalID)
	if tx == "" {
		r.h.T().Fatalf("record %s is %s without a transaction", externalID, state)
	}

	out := map[string]int64{}
	for _, p := range r.h.Transaction(tx).Postings {
		out[p.AccountID] = p.Amount.Amount
	}

	return out
}

func (r reserveFixture) wantReview(externalID, reason string) {
	r.h.T().Helper()

	var state, got string

	row := r.h.Pool.QueryRow(r.h.T().Context(), `SELECT state, coalesce(review_reason, '') FROM ingestion_external_record WHERE external_id = $1`, externalID)
	if err := row.Scan(&state, &got); err != nil {
		r.h.T().Fatal(err)
	}

	if state != "needs_review" || got != reason {
		r.h.T().Fatalf("record %s is %s (%s), want needs_review (%s)", externalID, state, got, reason)
	}
}
