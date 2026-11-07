package ingestion_test

import (
	"net/http"
	"testing"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

// S344 (A214): an account the item stops listing does not stop the others, the connection ends
// without a last error, and a later listing clears the mark.
func TestS344AccountNoLongerListed(t *testing.T) {
	t.Parallel()

	f := newSyncFixture(t)
	savings := f.h.Account("Savings", "asset", "savings", nil)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.mapTo(pluggy.SubtypeSavings, savings)
	f.sync()

	f.p.ChangeAccountID(nubankItem+"-checking", nubankItem+"-checking-2")
	f.p.AddTransaction(nubankItem+"-savings", bankLine("s344-savings", "2026-11-12", "-5.00"))
	f.p.SetItemUpdatedAt(nubankItem, "2026-11-12T15:00:00.000Z")
	f.sync()

	if state, tx := f.recordOf("s344-savings"); tx == "" {
		t.Fatalf("the line of the other account is %s without a transaction", state)
	}

	conn := f.connection(f.h.Client, f.conn.ID)
	if conn.LastError != "" {
		t.Fatalf("last error = %q, want none", conn.LastError)
	}

	old := externalByID(t, conn, externalAccount(f.conn, pluggy.SubtypeChecking).ID)
	if old.State != "mapped" || old.GoneSince != "2026-11-12" {
		t.Fatalf("old account = %+v, want mapped and gone since 2026-11-12", old)
	}

	f.p.ChangeAccountID(nubankItem+"-checking-2", nubankItem+"-checking")
	f.p.SetItemUpdatedAt(nubankItem, "2026-11-12T16:00:00.000Z")
	f.sync()

	conn = f.connection(f.h.Client, f.conn.ID)
	if old = externalByID(t, conn, old.ID); old.GoneSince != "" {
		t.Fatalf("gone since = %q after a listing that holds it", old.GoneSince)
	}
}

// S345 (A214): mapping the new external account to the ledger account of a gone one replaces it,
// a reread line creates no second transaction, and a line under a new id follows its entry.
func TestS345ReplaceGoneAccount(t *testing.T) {
	t.Parallel()

	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.line(pluggy.SubtypeChecking, bankLine("s345-kept", "2026-11-05", "-7.00"))
	f.line(pluggy.SubtypeChecking, bankLine("s345-old-id", "2026-11-06", "-8.00"))
	f.sync()

	before := transactionCount(t, f.h)
	old := externalAccount(f.conn, pluggy.SubtypeChecking).ID

	f.p.ChangeAccountID(nubankItem+"-checking", nubankItem+"-checking-2")
	f.p.RemoveTransaction(nubankItem+"-checking-2", "s345-old-id")
	f.p.AddTransaction(nubankItem+"-checking-2", bankLine("s345-new-id", "2026-11-06", "-8.00"))
	f.p.AddTransaction(nubankItem+"-checking-2", bankLine("s345-new", "2026-11-12", "-6.00"))
	f.p.SetItemUpdatedAt(nubankItem, "2026-11-12T15:00:00.000Z")
	f.sync()

	replacement := pendingExternal(t, f, pluggy.SubtypeChecking)
	body := map[string]any{"account_id": f.checking, "sync_from": "2026-10-01"}

	if r := f.mapAccount(f.h.Client, f.conn.ID, replacement.ID, body); r.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", r.Status, r.Body)
	}

	conn := f.connection(f.h.Client, f.conn.ID)
	if x := externalByID(t, conn, old); x.State != "ignored" {
		t.Fatalf("old account = %+v, want ignored", x)
	}

	f.p.SetItemUpdatedAt(nubankItem, "2026-11-12T16:00:00.000Z")
	f.sync()

	if got := transactionCount(t, f.h); got != before+1 {
		t.Fatalf("transactions = %d, want %d", got, before+1)
	}

	if state, tx := f.recordOf("s345-new-id"); state != "matched" || tx == "" {
		t.Fatalf("line under a new id is %s with transaction %q, want matched", state, tx)
	}
}

// S345 (A214): a reserve under a new identification takes over the ledger account, and its
// balance is asserted again.
func TestS345ReplaceGoneReserve(t *testing.T) {
	t.Parallel()

	r := newReserveFixture(t, "Aaa")
	r.p.ChangeReservedIdentification(r.checkingID, "res-Aaa", "res-Aaa-2")
	r.syncAt("2026-11-12T15:00:00.000Z")

	replacement := pendingExternal(t, r.syncFixture, "RESERVED_BALANCE")
	body := map[string]any{"account_id": r.reserves["Aaa"], "sync_from": "2026-11-11"}

	if m := r.mapAccount(r.h.Client, r.conn.ID, replacement.ID, body); m.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", m.Status, m.Body)
	}

	r.p.AddTransaction(r.checkingID, reserveLine("s345-reserve", "2026-11-12", "Dinheiro reservado Aaa", "-1.00"))
	r.syncAt("2026-11-12T16:00:00.000Z")

	if got := r.postings("s345-reserve"); got[r.reserves["Aaa"]] != 100 {
		t.Fatalf("postings = %v, want 100 on the reserve", got)
	}
}

// A214: a ledger account held by an external account the item still lists keeps the 422.
func TestMappingOverAListedAccountIsRefused(t *testing.T) {
	t.Parallel()

	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)

	body := map[string]any{"account_id": f.checking, "sync_from": "2026-10-01"}
	external := externalAccount(f.conn, pluggy.SubtypeSavings).ID
	f.h.ExpectProblem(f.mapAccount(f.h.Client, f.conn.ID, external, body), http.StatusUnprocessableEntity, "validation_failed", "account_id")
}

// Rename of an ordinary account: the mapping stays and the next line is recorded (A94).
func TestRenamedAccountKeepsItsMapping(t *testing.T) {
	t.Parallel()

	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.sync()

	f.p.RenameAccount(nubankItem+"-checking", "Conta Nova")
	f.p.AddTransaction(nubankItem+"-checking", bankLine("renamed", "2026-11-12", "-5.00"))
	f.p.SetItemUpdatedAt(nubankItem, "2026-11-12T15:00:00.000Z")
	f.sync()

	conn := f.connection(f.h.Client, f.conn.ID)
	if x := externalAccount(conn, pluggy.SubtypeChecking); x.Name != "Conta Nova" || x.AccountID != f.checking || x.State != "mapped" {
		t.Fatalf("account = %+v", x)
	}

	if state, tx := f.recordOf("renamed"); tx == "" {
		t.Fatalf("line is %s without a transaction", state)
	}
}

func externalByID(t *testing.T, c connectionView, id string) externalAccountView {
	t.Helper()

	for _, x := range c.Accounts {
		if x.ID == id {
			return x
		}
	}

	t.Fatalf("no external account %s in %+v", id, c.Accounts)

	return externalAccountView{}
}

func pendingExternal(t *testing.T, f syncFixture, subtype string) externalAccountView {
	t.Helper()

	for _, x := range f.connection(f.h.Client, f.conn.ID).Accounts {
		if x.Subtype == subtype && x.State == "pending" {
			return x
		}
	}

	t.Fatalf("no pending %s account", subtype)

	return externalAccountView{}
}
