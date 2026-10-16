package ingestion_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
)

type syncResult struct {
	Connection connectionView `json:"connection"`
	Batches    []syncBatch    `json:"batches"`
}

func (f syncFixture) syncNow(c *http.Client, connection string) apitest.Response {
	f.h.T().Helper()
	return f.h.Call(c, http.MethodPost, "/api/v1/connections/"+connection+"/sync", nil)
}

func (f syncFixture) mustSyncNow(connection string) syncResult {
	f.h.T().Helper()
	r := f.syncNow(f.h.Client, connection)
	if r.Status != http.StatusOK {
		f.h.T().Fatalf("sync status %d: %s", r.Status, r.Body)
	}
	var out syncResult
	r.Decode(f.h.T(), &out)
	return out
}

func (f syncFixture) tick() {
	f.h.T().Helper()
	f.h.App.Ingestion.Tick(f.h.T().Context())
}

func (f syncFixture) setItemUpdated(clientID, itemID, connector, at string) {
	it := pluggy.Item{ID: itemID, Status: pluggy.StatusUpdated, LastUpdatedAt: &at}
	it.Connector.Name = connector
	f.p.AddItemTo(clientID, it)
}

// S57 (item part): an item that needs its owner in Meu Pluggy is not synced; the
// connection reports its status and no batch is created.
func TestSyncSkipsABlockedItem(t *testing.T) {
	f := newSyncFixture(t)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-20", "-120.00"))
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	it := pluggy.Item{ID: nubankItem, Status: "LOGIN_ERROR", LastUpdatedAt: new("2026-11-12T09:00:00.000Z")}
	it.Connector.Name = "Nubank"
	f.p.AddItem(it)

	res := f.mustSyncNow(f.conn.ID)
	f.tick()
	if len(res.Batches) != 0 || res.Connection.ProviderStatus != "LOGIN_ERROR" || res.Connection.LastSyncedAt != "" {
		t.Fatalf("result = %+v", res)
	}
	if got := f.connection(f.h.Client, f.conn.ID); got.ProviderStatus != "LOGIN_ERROR" || len(f.batches(f.checking)) != 0 {
		t.Fatalf("connection = %+v, batches %d", got, len(f.batches(f.checking)))
	}
}

// A43: a tick syncs a connection only when its item has data newer than the last sync; a
// manual sync always runs.
func TestTickSyncsOnlyUpdatedItems(t *testing.T) {
	f := newSyncFixture(t)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-20", "-120.00"))
	f.mapTo(pluggy.SubtypeChecking, f.checking)

	f.tick()
	got := f.connection(f.h.Client, f.conn.ID)
	if len(f.batches(f.checking)) != 1 || got.LastSyncedAt == "" || got.LastError != "" || got.LastItemUpdateAt != "2026-11-12T06:00:00Z" {
		t.Fatalf("first tick: connection %+v, batches %d", got, len(f.batches(f.checking)))
	}
	f.tick()
	if n := len(f.batches(f.checking)); n != 1 {
		t.Fatalf("a tick without new data made %d batches", n)
	}
	f.setItemUpdated(pluggyClient, nubankItem, "Nubank", "2026-11-12T09:00:00.000Z")
	f.tick()
	if n := len(f.batches(f.checking)); n != 2 {
		t.Fatalf("a tick after an item update made %d batches", n)
	}
	if res := f.mustSyncNow(f.conn.ID); len(res.Batches) != 1 || res.Batches[0].Counts.Ignored != 1 || res.Connection.ID != f.conn.ID {
		t.Fatalf("manual sync = %+v", res)
	}
}

// S58: two users sync on one tick; each ledger receives only its own lines, and neither
// user can sync the other's connection.
func TestTickOverTwoUsers(t *testing.T) {
	f := newSyncFixture(t)
	f.line(pluggy.SubtypeChecking, bankLine("tx-owner", "2026-10-20", "-120.00"))
	f.mapTo(pluggy.SubtypeChecking, f.checking)

	f.p.SetCredentials("client-2b7d", "secret-2c90")
	f.serveItem("client-2b7d", "item-other-41", "Inter")
	f.p.AddTransaction("item-other-41-checking", bankLine("tx-other", "2026-10-21", "-75.00"))
	other := f.h.Login("other@example.com")
	in := f.integrate(other, "Meu Pluggy", "client-2b7d", "secret-2c90")
	conn := f.mustConnect(other, in.ID, "item-other-41")
	var account struct {
		ID string `json:"id"`
	}
	if r := f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Inter checking", "class": "asset", "kind": "checking", "currency": "BRL"}); r.Status != http.StatusCreated {
		t.Fatalf("account status %d: %s", r.Status, r.Body)
	} else {
		r.Decode(t, &account)
	}
	if r := f.mapAccount(other, conn.ID, externalAccount(conn, pluggy.SubtypeChecking).ID, map[string]any{"account_id": account.ID, "sync_from": "2026-10-01"}); r.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", r.Status, r.Body)
	}

	f.tick()
	var otherID int64
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT id FROM identity_user WHERE email = 'other@example.com'`).Scan(&otherID); err != nil {
		t.Fatal(err)
	}
	for user, want := range map[int64]string{f.h.OwnerID(): "tx-owner", otherID: "tx-other"} {
		var ids []string
		rows, err := f.h.Pool.Query(t.Context(), `SELECT external_id FROM ingestion_external_record WHERE user_id = $1`, user)
		if err != nil {
			t.Fatal(err)
		}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				t.Fatal(err)
			}
			ids = append(ids, id)
		}
		if rows.Err() != nil || len(ids) != 1 || ids[0] != want {
			t.Fatalf("user %d records = %v, want [%s]", user, ids, want)
		}
	}
	f.h.ExpectProblem(f.syncNow(other, f.conn.ID), http.StatusNotFound, "not_found", "")
	f.h.ExpectProblem(f.syncNow(f.h.Client, conn.ID), http.StatusNotFound, "not_found", "")
}

// S59 and Review Focus 4: a wrong secret on one integration leaves the other syncing, and
// the failure is logged by equori ids only.
func TestTickWithTwoIntegrations(t *testing.T) {
	f := newSyncFixture(t)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-20", "-120.00"))
	f.mapTo(pluggy.SubtypeChecking, f.checking)

	f.p.SetCredentials("client-2b7d", "secret-2c90")
	f.serveItem("client-2b7d", "item-second-77", "Inter")
	f.p.AddTransaction("item-second-77-checking", bankLine("tx-2", "2026-10-21", "-75.00"))
	in := f.integrate(f.h.Client, "Meu Pluggy 2", "client-2b7d", "secret-2c90")
	second := f.mustConnect(f.h.Client, in.ID, "item-second-77")
	inter := f.h.Account("Inter checking", "asset", "checking", nil)
	if r := f.mapAccount(f.h.Client, second.ID, externalAccount(second, pluggy.SubtypeChecking).ID, map[string]any{"account_id": inter, "sync_from": "2026-10-01"}); r.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", r.Status, r.Body)
	}
	f.p.SetCredentials("client-2b7d", "secret-2c91")
	f.p.RevokeKeys()

	f.tick()
	if len(f.batches(f.checking)) != 1 || len(f.batches(inter)) != 0 {
		t.Fatalf("batches: first %d, second %d", len(f.batches(f.checking)), len(f.batches(inter)))
	}
	failed := f.connection(f.h.Client, second.ID)
	if failed.LastError == "" || failed.LastSyncedAt != "" {
		t.Fatalf("failed connection = %+v", failed)
	}
	if ok := f.connection(f.h.Client, f.conn.ID); ok.LastError != "" || ok.LastSyncedAt == "" {
		t.Fatalf("synced connection = %+v", ok)
	}
	f.h.ExpectProblem(f.syncNow(f.h.Client, second.ID), http.StatusUnprocessableEntity, "provider_unauthorized", "integration_id")
	logs := f.h.Logs()
	if !strings.Contains(logs, "sync failed") || !strings.Contains(logs, second.ID) {
		t.Fatalf("the failed sync is not logged with its connection id")
	}
	assertNoSecrets(t, f.h, "secret-2c90", "secret-2c91", "item-second-77")
}

// Review Focus 2: a manual sync during another sync of the account waits for the account
// lock and then finds nothing new.
func TestManualSyncWaitsForTheAccountLock(t *testing.T) {
	f := newSyncFixture(t)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-20", "-120.00"))
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.mustSyncNow(f.conn.ID)

	holder, err := f.h.Pool.Acquire(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer holder.Release()
	if _, err := holder.Exec(t.Context(), `SELECT pg_advisory_lock(hashtextextended($1, 0))`, f.checking); err != nil {
		t.Fatal(err)
	}
	f.line(pluggy.SubtypeChecking, bankLine("tx-2", "2026-10-21", "-75.00"))
	done := make(chan apitest.Response, 1)
	go func() { done <- f.syncNow(f.h.Client, f.conn.ID) }()
	for waiting := false; !waiting; {
		select {
		case r := <-done:
			t.Fatalf("sync finished while the account was locked: %d %s", r.Status, r.Body)
		default:
		}
		if err := f.h.Pool.QueryRow(t.Context(), `SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted)`).Scan(&waiting); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := holder.Exec(t.Context(), `SELECT pg_advisory_unlock(hashtextextended($1, 0))`, f.checking); err != nil {
		t.Fatal(err)
	}
	if r := <-done; r.Status != http.StatusOK {
		t.Fatalf("sync status %d: %s", r.Status, r.Body)
	}
	if n := f.count(`SELECT count(*) FROM ingestion_external_record WHERE account_id = $1`, f.checking); n != 2 {
		t.Fatalf("records = %d", n)
	}
}

// Review Focus 2: a sync interrupted after some batches completes on the next one without
// duplicates.
func TestInterruptedSyncCompletes(t *testing.T) {
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-10-20", "-120.00"))
	f.line(pluggy.SubtypeCard, cardLine("card-1", "2026-11-02", "230.00", "POSTED", nil))
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.mapTo(pluggy.SubtypeCard, card)
	f.p.FailTransactions(nubankItem+"-card", http.StatusBadRequest)

	f.h.ExpectProblem(f.syncNow(f.h.Client, f.conn.ID), http.StatusBadGateway, "provider_unavailable", "")
	if got := f.connection(f.h.Client, f.conn.ID); got.LastError == "" || len(f.batches(f.checking)) != 1 || len(f.batches(card)) != 0 {
		t.Fatalf("after the failure: connection %+v, batches %d/%d", got, len(f.batches(f.checking)), len(f.batches(card)))
	}
	transactions := transactionCount(t, f.h)

	f.p.FailTransactions(nubankItem+"-card", 0)
	res := f.mustSyncNow(f.conn.ID)
	if len(res.Batches) != 2 || res.Connection.LastError != "" {
		t.Fatalf("result = %+v", res)
	}
	if got := transactionCount(t, f.h); got != transactions+1 {
		t.Fatalf("transactions %d → %d, want one card line", transactions, got)
	}
	if b := f.batches(f.checking)[0]; b.Counts.Ignored != 1 || b.Counts.Created != 0 {
		t.Fatalf("checking batch = %+v", b)
	}
}
