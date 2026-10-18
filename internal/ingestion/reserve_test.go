package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
)

const mercadoPagoItem = "item-mercadopago-3b7c10"

func reserved(name, identification string, amount pluggy.Decimal) pluggy.ReservedBalance {
	return pluggy.ReservedBalance{
		Name: name, Identification: identification,
		AvailableAmounts: []pluggy.ReservedAmount{{Amount: amount, CurrencyCode: "BRL"}},
	}
}

func reservedByName(c connectionView, name string) externalAccountView {
	for _, x := range c.Accounts {
		if x.Name == name {
			return x
		}
	}
	return externalAccountView{}
}

// S68: reserved balances of a bank account are external accounts that map only to a
// reserve; each sync adds the ones the connection lacks (D1, A73).
func TestS68ReservedBalanceMapping(t *testing.T) {
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "Nubank")
	it := pluggy.Item{ID: mercadoPagoItem, Status: pluggy.StatusUpdated, LastUpdatedAt: new("2026-11-12T06:00:00.000Z")}
	it.Connector.Name = "Mercado Pago"
	a.p.AddItemTo(pluggyClient, it)
	checkingID := mercadoPagoItem + "-checking"
	a.p.AddAccount(mercadoPagoItem, pluggy.Account{ID: checkingID, Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Mercado Pago", Number: checkingNumber, Balance: "500.05", CurrencyCode: "BRL"})
	a.p.AddReservedBalance(checkingID, reserved("Cofrinho Mercado Livre", "res-cofrinho", "1002.92"))
	a.p.AddReservedBalance(checkingID, reserved("Algum dinheiro", "res-algum", "8135.94"))
	// A reserved balance without an amount in the account currency is not listed.
	a.p.AddReservedBalance(checkingID, pluggy.ReservedBalance{
		Name: "Dolares", Identification: "res-usd",
		AvailableAmounts: []pluggy.ReservedAmount{{Amount: "10.00", CurrencyCode: "USD"}},
	})
	checking := a.h.Account("Mercado Pago", "asset", "checking", nil)
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)

	conn := a.mustConnect(a.h.Client, in.ID, mercadoPagoItem)
	if len(conn.Accounts) != 3 {
		t.Fatalf("accounts = %+v", conn.Accounts)
	}
	for _, x := range conn.Accounts {
		if x.State != "pending" {
			t.Fatalf("account = %+v, want pending", x)
		}
	}
	cofrinho := reservedByName(conn, "Cofrinho Mercado Livre")
	if cofrinho.Type != "BANK" || cofrinho.Subtype != "RESERVED_BALANCE" || cofrinho.NumberLast4 != "" || cofrinho.Currency != "BRL" {
		t.Fatalf("cofrinho = %+v", cofrinho)
	}
	if algum := reservedByName(conn, "Algum dinheiro"); algum.Subtype != "RESERVED_BALANCE" || algum.NumberLast4 != "" {
		t.Fatalf("algum dinheiro = %+v", algum)
	}

	a.h.ExpectProblem(a.mapAccount(a.h.Client, conn.ID, cofrinho.ID, map[string]any{"account_id": checking, "sync_from": "2026-11-11"}),
		http.StatusUnprocessableEntity, "validation_failed", "account_id")

	mp := externalAccount(conn, pluggy.SubtypeChecking)
	if r := a.mapAccount(a.h.Client, conn.ID, mp.ID, map[string]any{"account_id": checking, "sync_from": "2026-11-11"}); r.Status != http.StatusOK {
		t.Fatalf("map checking status %d: %s", r.Status, r.Body)
	}
	a.p.AddReservedBalance(checkingID, reserved("Viagem", "res-viagem", "250.00"))
	if err := a.h.App.Ingestion.SyncConnection(t.Context(), a.h.OwnerID(), uuid.MustParse(conn.ID)); err != nil {
		t.Fatalf("sync: %v", err)
	}
	conn = a.connection(a.h.Client, conn.ID)
	if len(conn.Accounts) != 4 {
		t.Fatalf("accounts after the sync = %+v", conn.Accounts)
	}
	if v := reservedByName(conn, "Viagem"); v.State != "pending" || v.Subtype != "RESERVED_BALANCE" || v.Currency != "BRL" {
		t.Fatalf("viagem = %+v", v)
	}
	if got := externalAccount(conn, pluggy.SubtypeChecking); got.State != "mapped" || got.AccountID != checking {
		t.Fatalf("checking = %+v", got)
	}
	if got := reservedByName(conn, "Cofrinho Mercado Livre"); got.ID != cofrinho.ID || got.State != "pending" {
		t.Fatalf("cofrinho after the sync = %+v", got)
	}

	// A second sync adds nothing.
	if err := a.h.App.Ingestion.SyncConnection(t.Context(), a.h.OwnerID(), uuid.MustParse(conn.ID)); err != nil {
		t.Fatalf("second sync: %v", err)
	}
	if got := a.connection(a.h.Client, conn.ID); len(got.Accounts) != 4 {
		t.Fatalf("accounts after the second sync = %+v", got.Accounts)
	}

	reserve := a.h.Account("MP Cofrinho", "asset", "reserve", nil)
	var mapped externalAccountView
	r := a.mapAccount(a.h.Client, conn.ID, cofrinho.ID, map[string]any{"account_id": reserve, "sync_from": "2026-11-11"})
	if r.Status != http.StatusOK {
		t.Fatalf("map cofrinho status %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &mapped)
	if mapped.State != "mapped" || mapped.AccountID != reserve || mapped.SyncFrom != "2026-11-11" || mapped.Subtype != "RESERVED_BALANCE" {
		t.Fatalf("mapped cofrinho = %+v", mapped)
	}

	nubank := a.mustConnect(a.h.Client, in.ID, nubankItem)
	if len(nubank.Accounts) != 3 {
		t.Fatalf("nubank accounts = %+v", nubank.Accounts)
	}
	for _, x := range nubank.Accounts {
		if x.Subtype == "RESERVED_BALANCE" {
			t.Fatalf("nubank lists a reserve: %+v", x)
		}
	}

	other := a.h.Login("other@example.com")
	a.h.ExpectProblem(a.h.Call(other, http.MethodGet, "/api/v1/connections/"+conn.ID, nil), http.StatusNotFound, "not_found", "")
}

// openingBalances returns the id of the user's Opening balances account.
func openingBalances(f syncFixture) string {
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
			return a.ID
		}
	}
	f.h.T().Fatal("no opening balances account")
	return ""
}

// S68: a mapped reserved balance syncs as one batch without lines whose balance is asserted
// from the reserve amount; a reserve the item stops reporting syncs without a balance (D2,
// A74).
func TestS68ReservedBalanceSync(t *testing.T) {
	a := newAggregator(t)
	it := pluggy.Item{ID: mercadoPagoItem, Status: pluggy.StatusUpdated, LastUpdatedAt: new("2026-11-10T15:00:00.000Z")}
	it.Connector.Name = "Mercado Pago"
	a.p.AddItemTo(pluggyClient, it)
	checkingID := mercadoPagoItem + "-checking"
	a.p.AddAccount(mercadoPagoItem, pluggy.Account{ID: checkingID, Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Mercado Pago", Number: checkingNumber, Balance: "500.05", CurrencyCode: "BRL"})
	a.p.AddReservedBalance(checkingID, reserved("Cofrinho Mercado Livre", "res-cofrinho", "1002.92"))
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	conn := a.mustConnect(a.h.Client, in.ID, mercadoPagoItem)
	f := syncFixture{aggregator: a, conn: conn}
	checking := a.h.Account("Mercado Pago", "asset", "checking", nil)
	reserve := a.h.Account("MP Cofrinho", "asset", "reserve", nil)
	a.h.Record("2026-11-10", apitest.Posting(reserve, 100292), apitest.Posting(openingBalances(f), -100292))
	body := func(account string) map[string]any {
		return map[string]any{"account_id": account, "sync_from": "2026-11-11"}
	}
	for _, m := range []struct{ external, ledger string }{{externalAccount(conn, pluggy.SubtypeChecking).ID, checking}, {reservedByName(conn, "Cofrinho Mercado Livre").ID, reserve}} {
		if r := a.mapAccount(a.h.Client, conn.ID, m.external, body(m.ledger)); r.Status != http.StatusOK {
			t.Fatalf("map status %d: %s", r.Status, r.Body)
		}
	}

	f.sync()
	if n := a.p.Requests("/v2/transactions"); n != 1 {
		t.Fatalf("transaction requests = %d, want 1 (the checking account only)", n)
	}
	got := f.batches(reserve)
	if len(got) != 1 {
		t.Fatalf("reserve batches = %+v", got)
	}
	b := got[0]
	if b.Counts.Received != 0 || b.Source != "open_finance" || b.Balance.Status != "recorded" || b.Balance.Date != "2026-11-10" || b.Balance.Amount.Amount != 100292 {
		t.Fatalf("reserve batch = %+v", b)
	}
	as := f.assertions(reserve)
	if len(as) != 1 || as[0].Source != "open_finance" || !as[0].Reconciled || as[0].Date != "2026-11-10" || as[0].Amount.Amount != 100292 {
		t.Fatalf("assertions = %+v", as)
	}

	a.p.RemoveReservedBalance(checkingID, "res-cofrinho")
	a.p.SetItemUpdatedAt(mercadoPagoItem, "2026-11-11T15:00:00.000Z")
	f.sync()
	got = f.batches(reserve)
	if len(got) != 2 || got[0].Balance.Status != "none" || got[0].Counts.Received != 0 {
		t.Fatalf("reserve batches after the reserve disappeared = %+v", got)
	}
	if as := f.assertions(reserve); len(as) != 1 {
		t.Fatalf("assertions after the reserve disappeared = %+v", as)
	}
}
