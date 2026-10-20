package ingestion_test

import (
	"maps"
	"net/http"
	"testing"
	"time"

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
	t.Parallel()
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
	// A reserved balance without an identification, or repeating one already listed, is not
	// listed: the connection would otherwise violate its external account key.
	a.p.AddReservedBalance(checkingID, reserved("Sem identificacao", "", "5.00"))
	a.p.AddReservedBalance(checkingID, reserved("Repetida", "res-cofrinho", "7.00"))
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
	t.Parallel()
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

// reserveAfterFirstSync is the S68 setup after the sync of 2026-11-10: a mapped reserve of
// 1,002.92 whose assertion is reconciled.
func reserveAfterFirstSync(t *testing.T, yieldMode string) (f syncFixture, reserve, reservedID string) {
	t.Helper()
	a := newAggregator(t)
	it := pluggy.Item{ID: mercadoPagoItem, Status: pluggy.StatusUpdated, LastUpdatedAt: new("2026-11-10T15:00:00.000Z")}
	it.Connector.Name = "Mercado Pago"
	a.p.AddItemTo(pluggyClient, it)
	checkingID := mercadoPagoItem + "-checking"
	a.p.AddAccount(mercadoPagoItem, pluggy.Account{ID: checkingID, Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Mercado Pago", Number: checkingNumber, Balance: "500.05", CurrencyCode: "BRL"})
	a.p.AddReservedBalance(checkingID, reserved("Cofrinho Mercado Livre", "res-cofrinho", "1002.92"))
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	f = syncFixture{aggregator: a, conn: a.mustConnect(a.h.Client, in.ID, mercadoPagoItem)}
	reserve = a.h.Account("MP Cofrinho", "asset", "reserve", map[string]any{"yield_mode": yieldMode})
	a.h.Record("2026-11-10", apitest.Posting(reserve, 100292), apitest.Posting(openingBalances(f), -100292))
	body := map[string]any{"account_id": reserve, "sync_from": "2026-11-11"}
	if r := a.mapAccount(a.h.Client, f.conn.ID, reservedByName(f.conn, "Cofrinho Mercado Livre").ID, body); r.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", r.Status, r.Body)
	}
	f.sync()
	if as := f.assertions(reserve); len(as) != 1 || !as[0].Reconciled || as[0].Date != "2026-11-10" {
		t.Fatalf("assertions after the first sync = %+v", as)
	}
	return f, reserve, checkingID
}

// syncReserve reports amount for the reserve on day and syncs.
func (f syncFixture) syncReserve(checkingID, day string, amount pluggy.Decimal) {
	f.h.T().Helper()
	f.p.SetReservedAmount(checkingID, "res-cofrinho", amount)
	f.p.SetItemUpdatedAt(mercadoPagoItem, day+"T15:00:00.000Z")
	f.sync()
}

// yieldTransactions returns the yield transactions of the account, oldest first.
func (f syncFixture) yieldTransactions(account string) []apitest.TransactionView {
	f.h.T().Helper()
	rows, err := f.h.Pool.Query(f.h.T().Context(), `
		SELECT DISTINCT t.id::text, t.date FROM ledger_transaction t
		JOIN ledger_posting p ON p.transaction_id = t.id
		WHERE p.account_id = $1 AND t.description LIKE 'Yield %' ORDER BY t.date`, account)
	if err != nil {
		f.h.T().Fatal(err)
	}
	defer rows.Close()
	var out []apitest.TransactionView
	for rows.Next() {
		var id string
		var date time.Time
		if err := rows.Scan(&id, &date); err != nil {
			f.h.T().Fatal(err)
		}
		out = append(out, f.h.Transaction(id))
	}
	if err := rows.Err(); err != nil {
		f.h.T().Fatal(err)
	}
	return out
}

// reserveDifference returns the open difference of the account in minor units, and whether
// one is open.
func (f syncFixture) reserveDifference(account string) (int64, bool) {
	f.h.T().Helper()
	var out struct {
		OpenDifference *struct {
			Difference struct {
				Amount int64 `json:"amount"`
			} `json:"difference"`
		} `json:"open_difference"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+account+"/reconciliation", nil, http.StatusOK, &out)
	if out.OpenDifference == nil {
		return 0, false
	}
	return out.OpenDifference.Difference.Amount, true
}

func wantYield(t *testing.T, f syncFixture, reserve, description string, amount int64) {
	t.Helper()
	ys := f.yieldTransactions(reserve)
	if len(ys) != 1 || ys[0].Description != description || ys[0].Origin != "system" || len(ys[0].Postings) != 2 {
		t.Fatalf("yield transactions = %+v, want one %q", ys, description)
	}
	for _, p := range ys[0].Postings {
		want := -amount
		if p.AccountID == reserve {
			want = amount
		}
		if p.Amount.Amount != want {
			t.Fatalf("posting = %+v, want %d", p, want)
		}
	}
}

// S69: the difference of a mapped reserve books as yield only within the bound of 3% per 30
// days of the settled balance, for a reserve with automatic yield (D3, A75).
func TestS69BoundedReserveYield(t *testing.T) {
	t.Parallel()
	t.Run("within and above the bound", func(t *testing.T) {
		f, reserve, checkingID := reserveAfterFirstSync(t, "auto")
		// B = floor(100292 * 3 * 1 / 3000) = 100.
		f.syncReserve(checkingID, "2026-11-11", "1003.52")
		as := f.assertions(reserve)
		if len(as) != 2 || as[0].Date != "2026-11-11" || !as[0].Reconciled || as[0].Amount.Amount != 100352 {
			t.Fatalf("assertions = %+v", as)
		}
		wantYield(t, f, reserve, "Yield 2026-11-11 to 2026-11-11", 60)
		if _, open := f.reserveDifference(reserve); open {
			t.Fatal("a yield leaves no open difference")
		}

		// B = floor(100352 * 3 * 1 / 3000) = 100; the difference 101 exceeds it.
		f.syncReserve(checkingID, "2026-11-12", "1004.53")
		as = f.assertions(reserve)
		if len(as) != 3 || as[0].Date != "2026-11-12" || as[0].Reconciled {
			t.Fatalf("assertions = %+v", as)
		}
		if d, open := f.reserveDifference(reserve); !open || d != 101 {
			t.Fatalf("open difference = %d, %v; want 101", d, open)
		}
		if n := len(f.yieldTransactions(reserve)); n != 1 {
			t.Fatalf("yield transactions = %d, want 1", n)
		}
	})

	t.Run("difference equal to the bound", func(t *testing.T) {
		f, reserve, checkingID := reserveAfterFirstSync(t, "auto")
		f.syncReserve(checkingID, "2026-11-11", "1003.52")
		f.syncReserve(checkingID, "2026-11-12", "1004.52")
		as := f.assertions(reserve)
		if len(as) != 3 || as[0].Date != "2026-11-12" || !as[0].Reconciled {
			t.Fatalf("assertions = %+v", as)
		}
		ys := f.yieldTransactions(reserve)
		if len(ys) != 2 || ys[1].Description != "Yield 2026-11-12 to 2026-11-12" || ys[1].Postings[0].Amount.Amount+ys[1].Postings[1].Amount.Amount != 0 {
			t.Fatalf("yield transactions = %+v", ys)
		}
	})

	t.Run("amount below the settled balance", func(t *testing.T) {
		f, reserve, checkingID := reserveAfterFirstSync(t, "auto")
		f.syncReserve(checkingID, "2026-11-11", "1002.00")
		if d, open := f.reserveDifference(reserve); !open || d != -92 {
			t.Fatalf("open difference = %d, %v; want -92", d, open)
		}
		if n := len(f.yieldTransactions(reserve)); n != 0 {
			t.Fatalf("yield transactions = %d, want 0", n)
		}
	})

	t.Run("yield mode none", func(t *testing.T) {
		f, reserve, checkingID := reserveAfterFirstSync(t, "none")
		f.syncReserve(checkingID, "2026-11-11", "1003.52")
		if as := f.assertions(reserve); len(as) != 2 || as[0].Reconciled {
			t.Fatalf("assertions = %+v", as)
		}
		if d, open := f.reserveDifference(reserve); !open || d != 60 {
			t.Fatalf("open difference = %d, %v; want 60", d, open)
		}
		if n := len(f.yieldTransactions(reserve)); n != 0 {
			t.Fatalf("yield transactions = %d, want 0", n)
		}
	})

	// Assertions of one date and amount decide in creation order, newest first: the yield is
	// booked once and the older assertion reconciles with resolution none.
	t.Run("several open assertions of the sync date", func(t *testing.T) {
		f, reserve, checkingID := reserveAfterFirstSync(t, "auto")
		body := map[string]any{"date": "2026-11-11", "amount": apitest.BRL(100352), "source": "open_finance"}
		f.h.MustDo(http.MethodPost, "/api/v1/accounts/"+reserve+"/balance-assertions", body, http.StatusCreated, nil)
		f.h.MustDo(http.MethodPost, "/api/v1/accounts/"+reserve+"/balance-assertions", body, http.StatusCreated, nil)
		f.syncReserve(checkingID, "2026-11-11", "1003.52")
		as := f.assertions(reserve)
		if len(as) != 3 || !as[0].Reconciled || !as[1].Reconciled || !as[2].Reconciled {
			t.Fatalf("assertions = %+v", as)
		}
		wantYield(t, f, reserve, "Yield 2026-11-11 to 2026-11-11", 60)
		if n := f.count(`SELECT count(*) FROM ledger_reconciliation WHERE account_id = $1 AND date = '2026-11-11' AND resolution = 'yield' AND difference = 60`, reserve); n != 1 {
			t.Fatalf("yield reconciliations = %d, want 1", n)
		}
		if n := f.count(`SELECT count(*) FROM ledger_reconciliation WHERE account_id = $1 AND date = '2026-11-11' AND resolution = 'none' AND difference = 0`, reserve); n != 1 {
			t.Fatalf("none reconciliations = %d, want 1", n)
		}
	})
}

func reserveLine(id, date, description string, amount pluggy.Decimal) pluggy.Transaction {
	return pluggy.Transaction{
		ID: id, Description: description, Amount: amount, CurrencyCode: "BRL", Date: date + "T00:00:00.000Z", Status: "POSTED",
		OperationType: new("TRANSFERENCIA_SALDO_RESERVADO"),
	}
}

// S70: a checking line that names exactly one mapped reserve and is dated on or after its
// start date is booked as a transfer to the reserve; any other line follows the normal
// pipeline (D4, A76).
func TestS70ReserveTransfers(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	it := pluggy.Item{ID: mercadoPagoItem, Status: pluggy.StatusUpdated, LastUpdatedAt: new("2026-11-11T15:00:00.000Z")}
	it.Connector.Name = "Mercado Pago"
	a.p.AddItemTo(pluggyClient, it)
	checkingID := mercadoPagoItem + "-checking"
	a.p.AddAccount(mercadoPagoItem, pluggy.Account{ID: checkingID, Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Mercado Pago", Number: checkingNumber, Balance: "500.05", CurrencyCode: "BRL"})
	a.p.AddReservedBalance(checkingID, reserved("Cofrinho Mercado Livre", "res-cofrinho", "300.00"))
	a.p.AddReservedBalance(checkingID, reserved("Algum dinheiro", "res-algum", "100.00"))
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	f := syncFixture{aggregator: a, conn: a.mustConnect(a.h.Client, in.ID, mercadoPagoItem)}

	checking := a.h.Account("Mercado Pago", "asset", "checking", nil)
	cofrinho := a.h.Account("MP Cofrinho", "asset", "reserve", nil)
	algum := a.h.Account("MP Algum dinheiro", "asset", "reserve", nil)
	a.h.Record("2026-10-31", apitest.Posting(checking, 100000), apitest.Posting(openingBalances(f), -100000))
	a.h.Record("2026-11-10", apitest.Posting(cofrinho, 10000), apitest.Posting(openingBalances(f), -10000))
	a.h.Record("2026-11-10", apitest.Posting(algum, 20000), apitest.Posting(openingBalances(f), -20000))
	mapping := []struct{ external, ledger, from string }{
		{externalAccount(f.conn, pluggy.SubtypeChecking).ID, checking, "2026-11-01"},
		{reservedByName(f.conn, "Cofrinho Mercado Livre").ID, cofrinho, "2026-11-11"},
		{reservedByName(f.conn, "Algum dinheiro").ID, algum, "2026-11-11"},
	}
	for _, m := range mapping {
		if r := a.mapAccount(a.h.Client, f.conn.ID, m.external, map[string]any{"account_id": m.ledger, "sync_from": m.from}); r.Status != http.StatusOK {
			t.Fatalf("map status %d: %s", r.Status, r.Body)
		}
	}
	a.p.AddTransaction(checkingID, reserveLine("t-into", "2026-11-11", "Dinheiro reservado Cofrinho Mercado Livre", "-200.00"))
	a.p.AddTransaction(checkingID, reserveLine("t-out", "2026-11-11", "Dinheiro retirado Algum dinheiro", "100.00"))
	a.p.AddTransaction(checkingID, reserveLine("t-unknown", "2026-11-11", "Dinheiro retirado Aaa", "50.00"))
	a.p.AddTransaction(checkingID, reserveLine("t-before", "2026-11-10", "Dinheiro reservado Cofrinho Mercado Livre", "-30.00"))

	f.sync()
	// Reserves sync after the checking account: each reserve assertion meets its settled
	// balance, with the transfers booked, and reconciles with no resolution.
	for _, reserve := range []string{cofrinho, algum} {
		as := f.assertions(reserve)
		if len(as) != 1 || as[0].Source != "open_finance" || !as[0].Reconciled || as[0].Date != "2026-11-11" {
			t.Fatalf("assertions of %s after the first sync = %+v", reserve, as)
		}
		if n := f.count(`SELECT count(*) FROM ledger_reconciliation WHERE account_id = $1 AND assertion_id IS NOT NULL AND resolution = 'none' AND difference = 0`, reserve); n != 1 {
			t.Fatalf("reconciliations of %s with resolution none = %d, want 1", reserve, n)
		}
	}
	postings := func(externalID string) map[string]int64 {
		t.Helper()
		state, tx := f.recordOf(externalID)
		if tx == "" {
			t.Fatalf("record %s is %s without a transaction", externalID, state)
		}
		out := map[string]int64{}
		for _, p := range f.h.Transaction(tx).Postings {
			out[p.AccountID] = p.Amount.Amount
		}
		return out
	}
	for _, c := range []struct {
		external string
		want     map[string]int64
	}{
		{"t-into", map[string]int64{checking: -20000, cofrinho: 20000}},
		{"t-out", map[string]int64{checking: 10000, algum: -10000}},
	} {
		if got := postings(c.external); !maps.Equal(got, c.want) {
			t.Fatalf("postings of %s = %v, want %v", c.external, got, c.want)
		}
	}
	for _, id := range []string{"t-unknown", "t-before"} {
		got := postings(id)
		if _, ok := got[cofrinho]; ok {
			t.Fatalf("postings of %s = %v, want none on a reserve", id, got)
		}
		if _, ok := got[algum]; ok {
			t.Fatalf("postings of %s = %v, want none on a reserve", id, got)
		}
	}

	f.sync()
	if b := f.batches(checking)[0]; b.Counts.Received != 4 || b.Counts.Created != 0 {
		t.Fatalf("second sync batch = %+v, want 4 received and none created", b.Counts)
	}
}

// S70: a name held by two mapped reserves is ambiguous, so a line naming it books no
// transfer (D4 condition 4, A76).
func TestS70AmbiguousReserveName(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	it := pluggy.Item{ID: mercadoPagoItem, Status: pluggy.StatusUpdated, LastUpdatedAt: new("2026-11-11T15:00:00.000Z")}
	it.Connector.Name = "Mercado Pago"
	a.p.AddItemTo(pluggyClient, it)
	checkingID := mercadoPagoItem + "-checking"
	a.p.AddAccount(mercadoPagoItem, pluggy.Account{ID: checkingID, Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Mercado Pago", Number: checkingNumber, Balance: "500.05", CurrencyCode: "BRL"})
	a.p.AddReservedBalance(checkingID, reserved("Cofrinho", "res-first", "0.00"))
	a.p.AddReservedBalance(checkingID, reserved("Cofrinho", "res-second", "0.00"))
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	f := syncFixture{aggregator: a, conn: a.mustConnect(a.h.Client, in.ID, mercadoPagoItem)}

	checking := a.h.Account("Mercado Pago", "asset", "checking", nil)
	first := a.h.Account("MP Cofrinho 1", "asset", "reserve", nil)
	second := a.h.Account("MP Cofrinho 2", "asset", "reserve", nil)
	a.h.Record("2026-10-31", apitest.Posting(checking, 100000), apitest.Posting(openingBalances(f), -100000))
	var reserves []string
	for _, x := range f.conn.Accounts {
		if x.Subtype == "RESERVED_BALANCE" {
			reserves = append(reserves, x.ID)
		}
	}
	if len(reserves) != 2 {
		t.Fatalf("reserves = %+v", f.conn.Accounts)
	}
	for _, m := range []struct{ external, ledger, from string }{
		{externalAccount(f.conn, pluggy.SubtypeChecking).ID, checking, "2026-11-01"},
		{reserves[0], first, "2026-11-11"},
		{reserves[1], second, "2026-11-11"},
	} {
		if r := a.mapAccount(a.h.Client, f.conn.ID, m.external, map[string]any{"account_id": m.ledger, "sync_from": m.from}); r.Status != http.StatusOK {
			t.Fatalf("map status %d: %s", r.Status, r.Body)
		}
	}
	a.p.AddTransaction(checkingID, reserveLine("t-ambiguous", "2026-11-11", "Dinheiro reservado Cofrinho", "-50.00"))

	f.sync()
	state, tx := f.recordOf("t-ambiguous")
	if tx == "" {
		t.Fatalf("record is %s without a transaction", state)
	}
	for _, p := range f.h.Transaction(tx).Postings {
		if p.AccountID == first || p.AccountID == second {
			t.Fatalf("posting %+v on a reserve, want none", p)
		}
	}
}

// S68: a mapped reserved balance that no longer holds an amount in the parent currency is
// read as not reported: the batch records no balance and no assertion is added (D1, D2).
func TestS68ReserveWithoutParentCurrency(t *testing.T) {
	t.Parallel()
	f, reserve, checkingID := reserveAfterFirstSync(t, "none")
	f.p.RemoveReservedBalance(checkingID, "res-cofrinho")
	f.p.AddReservedBalance(checkingID, pluggy.ReservedBalance{
		Name: "Cofrinho Mercado Livre", Identification: "res-cofrinho",
		AvailableAmounts: []pluggy.ReservedAmount{{Amount: "10.00", CurrencyCode: "USD"}},
	})
	f.p.SetItemUpdatedAt(mercadoPagoItem, "2026-11-11T15:00:00.000Z")
	f.sync()
	got := f.batches(reserve)
	if len(got) != 2 || got[0].Balance.Status != "none" {
		t.Fatalf("reserve batches = %+v, want a second batch with balance none", got)
	}
	if as := f.assertions(reserve); len(as) != 1 {
		t.Fatalf("assertions = %+v, want the one of the first sync", as)
	}
}

// S90 (A94): a reserve renamed at the institution keeps its mapping; the sync stores the new
// name and keeps the former one, so a line naming either books a transfer to the reserve.
func TestS90RenamedReserve(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	it := pluggy.Item{ID: mercadoPagoItem, Status: pluggy.StatusUpdated, LastUpdatedAt: new("2026-11-11T15:00:00.000Z")}
	it.Connector.Name = "Mercado Pago"
	a.p.AddItemTo(pluggyClient, it)
	checkingID := mercadoPagoItem + "-checking"
	a.p.AddAccount(mercadoPagoItem, pluggy.Account{ID: checkingID, Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Mercado Pago", Number: checkingNumber, Balance: "500.05", CurrencyCode: "BRL"})
	a.p.AddReservedBalance(checkingID, reserved("Aaa", "res-aaa", "100.00"))
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	f := syncFixture{aggregator: a, conn: a.mustConnect(a.h.Client, in.ID, mercadoPagoItem)}

	checking := a.h.Account("Mercado Pago", "asset", "checking", nil)
	reserve := a.h.Account("MP Reserva", "asset", "reserve", nil)
	a.h.Record("2026-10-31", apitest.Posting(checking, 100000), apitest.Posting(openingBalances(f), -100000))
	a.h.Record("2026-11-10", apitest.Posting(reserve, 10000), apitest.Posting(openingBalances(f), -10000))
	for _, m := range []struct{ external, ledger, from string }{
		{externalAccount(f.conn, pluggy.SubtypeChecking).ID, checking, "2026-11-01"},
		{reservedByName(f.conn, "Aaa").ID, reserve, "2026-11-11"},
	} {
		if r := a.mapAccount(a.h.Client, f.conn.ID, m.external, map[string]any{"account_id": m.ledger, "sync_from": m.from}); r.Status != http.StatusOK {
			t.Fatalf("map status %d: %s", r.Status, r.Body)
		}
	}
	f.sync()

	a.p.RenameReservedBalance(checkingID, "res-aaa", "Algum dinheiro")
	a.p.SetReservedAmount(checkingID, "res-aaa", "110.00")
	a.p.SetItemUpdatedAt(mercadoPagoItem, "2026-11-12T15:00:00.000Z")
	a.p.AddTransaction(checkingID, reserveLine("t-new-name", "2026-11-12", "Dinheiro reservado Algum dinheiro", "-20.00"))
	a.p.AddTransaction(checkingID, reserveLine("t-former-name", "2026-11-11", "Dinheiro retirado Aaa", "10.00"))
	f.sync()

	conn := a.connection(a.h.Client, f.conn.ID)
	if x := reservedByName(conn, "Algum dinheiro"); x.ID != reservedByName(f.conn, "Aaa").ID || x.State != "mapped" {
		t.Fatalf("accounts after the rename = %+v", conn.Accounts)
	}
	for _, c := range []struct {
		external string
		want     map[string]int64
	}{
		{"t-new-name", map[string]int64{checking: -2000, reserve: 2000}},
		{"t-former-name", map[string]int64{checking: 1000, reserve: -1000}},
	} {
		state, tx := f.recordOf(c.external)
		if tx == "" {
			t.Fatalf("record %s is %s without a transaction", c.external, state)
		}
		got := map[string]int64{}
		for _, p := range f.h.Transaction(tx).Postings {
			got[p.AccountID] = p.Amount.Amount
		}
		if !maps.Equal(got, c.want) {
			t.Fatalf("postings of %s = %v, want %v", c.external, got, c.want)
		}
	}
	// The reserve meets the reported 110.00 with both transfers booked.
	as := f.assertions(reserve)
	reconciled := false
	for _, x := range as {
		reconciled = reconciled || (x.Date == "2026-11-12" && x.Reconciled)
	}
	if !reconciled {
		t.Fatalf("reserve assertions = %+v, want 2026-11-12 reconciled", as)
	}
}

// A94: a former name that another mapped reserve holds as its current name resolves to that
// reserve; the renamed reserve keeps its current name.
func TestReserveCurrentNameWinsOverFormerName(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	it := pluggy.Item{ID: mercadoPagoItem, Status: pluggy.StatusUpdated, LastUpdatedAt: new("2026-11-11T15:00:00.000Z")}
	it.Connector.Name = "Mercado Pago"
	a.p.AddItemTo(pluggyClient, it)
	checkingID := mercadoPagoItem + "-checking"
	a.p.AddAccount(mercadoPagoItem, pluggy.Account{ID: checkingID, Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Mercado Pago", Number: checkingNumber, Balance: "500.05", CurrencyCode: "BRL"})
	a.p.AddReservedBalance(checkingID, reserved("Viagem", "res-old", "0.00"))
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	f := syncFixture{aggregator: a, conn: a.mustConnect(a.h.Client, in.ID, mercadoPagoItem)}

	checking := a.h.Account("Mercado Pago", "asset", "checking", nil)
	house := a.h.Account("MP Casa", "asset", "reserve", nil)
	trip := a.h.Account("MP Viagem", "asset", "reserve", nil)
	a.h.Record("2026-10-31", apitest.Posting(checking, 100000), apitest.Posting(openingBalances(f), -100000))
	mapTo := func(external, ledger, from string) {
		t.Helper()
		if r := a.mapAccount(a.h.Client, f.conn.ID, external, map[string]any{"account_id": ledger, "sync_from": from}); r.Status != http.StatusOK {
			t.Fatalf("map status %d: %s", r.Status, r.Body)
		}
	}
	mapTo(externalAccount(f.conn, pluggy.SubtypeChecking).ID, checking, "2026-11-01")
	mapTo(reservedByName(f.conn, "Viagem").ID, house, "2026-11-11")
	f.sync()

	a.p.RenameReservedBalance(checkingID, "res-old", "Casa")
	a.p.AddReservedBalance(checkingID, reserved("Viagem", "res-new", "0.00"))
	a.p.SetItemUpdatedAt(mercadoPagoItem, "2026-11-12T15:00:00.000Z")
	f.sync()
	conn := a.connection(a.h.Client, f.conn.ID)
	mapTo(reservedByName(conn, "Viagem").ID, trip, "2026-11-12")

	a.p.AddTransaction(checkingID, reserveLine("t-trip", "2026-11-12", "Dinheiro reservado Viagem", "-40.00"))
	a.p.SetItemUpdatedAt(mercadoPagoItem, "2026-11-12T16:00:00.000Z")
	f.sync()
	state, tx := f.recordOf("t-trip")
	if tx == "" {
		t.Fatalf("record is %s without a transaction", state)
	}
	got := map[string]int64{}
	for _, p := range f.h.Transaction(tx).Postings {
		got[p.AccountID] = p.Amount.Amount
	}
	if want := (map[string]int64{checking: -4000, trip: 4000}); !maps.Equal(got, want) {
		t.Fatalf("postings = %v, want %v", got, want)
	}
}
