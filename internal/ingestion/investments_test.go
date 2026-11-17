package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	pluggy "github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

type investmentMovementView struct {
	ID           string `json:"id"`
	InvestmentID string `json:"investment_id"`
	Kind         string `json:"kind"`
	Date         string `json:"date"`
	Amount       struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	} `json:"amount"`
	State         string `json:"state"`
	Proposal      string `json:"proposal"`
	TransactionID string `json:"transaction_id"`
}

type investmentView struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Type             string `json:"type"`
	Subtype          string `json:"subtype"`
	Issuer           string `json:"issuer"`
	IndexID          string `json:"index_id"`
	PercentOfIndexBP int    `json:"percent_of_index_bp"`
	SpreadBP         int    `json:"spread_bp"`
	HasTerms         bool   `json:"has_terms"`
	MaturesOn        string `json:"matures_on"`
	Balance          struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	} `json:"balance"`
	BalanceDate string                   `json:"balance_date"`
	Instrument  string                   `json:"instrument"`
	BrokerageID string                   `json:"brokerage_id"`
	Movements   []investmentMovementView `json:"movements"`
}

// cdbItem serves a CDB at 110% of the CDI with a buy and an interest movement.
func (f syncFixture) cdbItem() {
	f.p.AddInvestment(nubankItem, f.cdb("1050.00", "2026-11-10"))
	f.p.AddInvestmentTransaction("inv-cdb", pluggy.InvestmentTransaction{
		ID: "m-buy", Type: "BUY", Date: "2026-01-10T00:00:00.000Z", Quantity: "1000",
		Amount: "1000.00",
	})
	f.p.AddInvestmentTransaction("inv-cdb", pluggy.InvestmentTransaction{
		ID: "m-interest", Type: "INTEREST", Date: "2026-10-01T00:00:00.000Z", Amount: "50.00",
	})
}

func (f syncFixture) cdb(balance, date string) pluggy.Investment {
	due := "2028-01-10T00:00:00.000Z"

	return pluggy.Investment{
		ID: "inv-cdb", Type: "FIXED_INCOME", Subtype: "CDB", Name: "CDB Bank 110",
		CurrencyCode: "BRL", Balance: pluggy.Decimal(balance), Quantity: "1000",
		Date: date + "T00:00:00.000Z", DueDate: &due, Issuer: "Bank SA", Rate: "110",
		RateType: "CDI",
	}
}

func (f syncFixture) investments(c *http.Client, connection string) []investmentView {
	f.h.T().Helper()

	r := f.h.Call(c, http.MethodGet, "/api/v1/connections/"+connection+"/investments", nil)
	if r.Status != http.StatusOK {
		f.h.T().Fatalf("investments status %d: %s", r.Status, r.Body)
	}

	var out struct {
		Investments []investmentView `json:"investments"`
	}
	r.Decode(f.h.T(), &out)

	return out.Investments
}

func TestSyncStoresInvestments_S541(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.cdbItem()
	f.sync()

	got := f.investments(f.h.Client, f.conn.ID)
	if len(got) != 1 {
		t.Fatalf("investments = %+v", got)
	}

	inv := got[0]
	if inv.Name != "CDB Bank 110" || inv.Type != "fixed_income" || inv.Subtype != "cdb" ||
		inv.Issuer != "Bank SA" || inv.IndexID != "cdi" || inv.PercentOfIndexBP != 11000 ||
		inv.SpreadBP != 0 || !inv.HasTerms || inv.MaturesOn != "2028-01-10" ||
		inv.Balance.Amount != 105000 || inv.Balance.Currency != "BRL" ||
		inv.BalanceDate != "2026-11-10" || inv.Instrument != "" {
		t.Fatalf("investment = %+v", inv)
	}

	if len(inv.Movements) != 2 {
		t.Fatalf("movements = %+v", inv.Movements)
	}

	for i, want := range []struct {
		kind, date, proposal string
		amount               int64
	}{
		{"buy", "2026-01-10", "application", 100000},
		{"income", "2026-10-01", "income", 5000},
	} {
		m := inv.Movements[i]
		if m.Kind != want.kind || m.Date != want.date || m.Proposal != want.proposal ||
			m.Amount.Amount != want.amount || m.Amount.Currency != "BRL" ||
			m.State != "pending" || m.InvestmentID != inv.ID || m.TransactionID != "" {
			t.Fatalf("movement %d = %+v, want %+v", i, m, want)
		}
	}
}

func TestSyncKeepsInvestmentsOnRepeat_S542(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.cdbItem()
	f.sync()

	first := f.investments(f.h.Client, f.conn.ID)

	f.p.AddInvestment(nubankItem, f.cdb("1062.40", "2026-11-11"))
	f.sync()

	got := f.investments(f.h.Client, f.conn.ID)
	if len(got) != 1 || got[0].ID != first[0].ID || len(got[0].Movements) != 2 {
		t.Fatalf("investments = %+v, first = %+v", got, first)
	}

	if got[0].Balance.Amount != 106240 || got[0].BalanceDate != "2026-11-11" {
		t.Fatalf("balance = %+v on %s", got[0].Balance, got[0].BalanceDate)
	}

	for i, m := range got[0].Movements {
		if m.ID != first[0].Movements[i].ID {
			t.Fatalf("movement %d id = %s, want %s", i, m.ID, first[0].Movements[i].ID)
		}
	}
}

func TestInvestmentsOfAConnectionByRole_S544(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.cdbItem()
	f.sync()

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	if got := f.investments(reader, f.conn.ID); len(got) != 1 {
		t.Fatalf("reader sees %+v", got)
	}

	other := f.h.Login("other@example.com")
	f.h.ExpectProblem(
		f.h.Call(other, http.MethodGet, "/api/v1/connections/"+f.conn.ID+"/investments", nil),
		http.StatusNotFound,
		"not_found",
		"",
	)
	f.h.ExpectProblem(
		f.h.Call(
			f.h.Client,
			http.MethodGet,
			"/api/v1/connections/019a0000-0000-7000-8000-000000000000/investments",
			nil,
		),
		http.StatusNotFound,
		"not_found",
		"",
	)
}

// Export design D1: both investment tables are facts; an archive keeps an investment and its
// movements.
func TestArchiveKeepsInvestments(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.cdbItem()
	f.sync()

	archive := exportWith(t, f.h, map[string]any{})
	target := newAggregator(t)

	r := target.h.UploadWith("/api/v1/imports/archive", nil, "export.zip", archive)
	if r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	var investments, movements int
	if err := target.h.Pool.QueryRow(
		t.Context(),
		`SELECT (SELECT count(*) FROM ingestion_external_investment WHERE books_id = $1),
			(SELECT count(*) FROM ingestion_investment_movement
				WHERE books_id = $1 AND state = 'pending' AND kind IN ('buy', 'income'))`,
		target.h.OwnerID(),
	).Scan(&investments, &movements); err != nil {
		t.Fatal(err)
	}

	if investments != 1 || movements != 2 {
		t.Fatalf("investments = %d, movements = %d; want 1 and 2", investments, movements)
	}
}

type reviewFixture struct {
	syncFixture
	client    *http.Client
	brokerage string
	cash      string
}

func newReviewFixture(t *testing.T) reviewFixture {
	f := newSyncFixture(t)
	brokerage, cash := brokerageWithCash(f.h, f.h.Client, "BRL", "BRL")

	return reviewFixture{syncFixture: f, client: f.h.Client, brokerage: brokerage, cash: cash}
}

// brokerageWithCash creates a brokerage and its cash account in the book of c.
func brokerageWithCash(
	h *apitest.Harness,
	c *http.Client,
	currency, cashCurrency string,
) (string, string) {
	h.T().Helper()

	create := func(body map[string]any, path string) string {
		r := h.Call(c, http.MethodPost, path, body)
		if r.Status != http.StatusCreated {
			h.T().Fatalf("POST %s = %d: %s", path, r.Status, r.Body)
		}

		var out struct {
			ID string `json:"id"`
		}
		r.Decode(h.T(), &out)

		return out.ID
	}

	institution := create(map[string]any{"name": "XP"}, "/api/v1/institutions")
	brokerage := create(map[string]any{
		"name": "XP", "class": "asset", "kind": "brokerage", "currency": currency,
		"institution_id": institution,
	}, "/api/v1/accounts")
	cash := create(map[string]any{
		"name": "XP cash", "class": "asset", "kind": "brokerage", "currency": cashCurrency,
		"institution_id": institution, "parent_id": brokerage,
	}, "/api/v1/accounts")

	return brokerage, cash
}

func pluggyMove(id, kind, date, amount string) pluggy.InvestmentTransaction {
	return pluggy.InvestmentTransaction{
		ID: id, Type: kind, Date: date + "T00:00:00.000Z", Quantity: pluggy.Decimal(amount),
		Amount: pluggy.Decimal(amount),
	}
}

// serve stores the CDB with moves and returns the investments of the connection.
func (f reviewFixture) serve(
	balance, date string,
	moves ...pluggy.InvestmentTransaction,
) investmentView {
	f.h.T().Helper()

	return f.serveInvestment(f.cdb(balance, date), moves...)
}

func (f reviewFixture) serveInvestment(
	inv pluggy.Investment,
	moves ...pluggy.InvestmentTransaction,
) investmentView {
	f.h.T().Helper()
	f.p.AddInvestment(nubankItem, inv)

	for _, m := range moves {
		f.p.AddInvestmentTransaction(inv.ID, m)
	}

	f.sync()

	return f.investments(f.client, f.conn.ID)[0]
}

func (f reviewFixture) applyBody() map[string]any {
	return map[string]any{"brokerage_id": f.brokerage, "cash_account_id": f.cash}
}

// incomeBody is the confirmation of an income on a new income category.
func (f reviewFixture) incomeBody() map[string]any {
	return map[string]any{"category_id": f.h.Account("Interest", "income", "", nil)}
}

func (f reviewFixture) act(
	c *http.Client,
	movement, action string,
	body any,
) apitest.Response {
	f.h.T().Helper()

	return f.h.Call(c, http.MethodPost, "/api/v1/investment-movements/"+movement+"/"+action, body)
}

func (f reviewFixture) must(movement, action string, body any) investmentMovementView {
	f.h.T().Helper()

	r := f.act(f.client, movement, action, body)
	if r.Status != http.StatusOK {
		f.h.T().Fatalf("%s status %d: %s", action, r.Status, r.Body)
	}

	var out investmentMovementView
	r.Decode(f.h.T(), &out)

	return out
}

func (f reviewFixture) investment() investmentView {
	f.h.T().Helper()

	return f.investments(f.client, f.conn.ID)[0]
}

func (v investmentView) movement(t *testing.T, kind, date string) investmentMovementView {
	t.Helper()

	for _, m := range v.Movements {
		if m.Kind == kind && m.Date == date {
			return m
		}
	}

	t.Fatalf("no %s movement on %s in %+v", kind, date, v.Movements)

	return investmentMovementView{}
}

func TestConfirmApplication_S545(t *testing.T) {
	t.Parallel()
	f := newReviewFixture(t)
	buy := f.serve("1000.00", "2026-01-10", pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00")).
		movement(t, "buy", "2026-01-10")

	f.h.ExpectProblem(
		f.act(f.client, buy.ID, "confirm", map[string]any{}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"brokerage_id",
	)

	got := f.must(buy.ID, "confirm", f.applyBody())
	if got.State != "confirmed" || got.TransactionID == "" {
		t.Fatalf("movement = %+v", got)
	}

	f.h.ExpectProblem(
		f.act(f.client, buy.ID, "confirm", f.applyBody()),
		http.StatusConflict,
		"investment_movement_resolved",
		"",
	)

	if inv := f.investment(); inv.Instrument == "" || inv.BrokerageID != f.brokerage {
		t.Fatalf("investment = %+v", inv)
	}

	rows := f.h.Rows(`SELECT quantity, unit_price::text, gross FROM ledger_trade`)
	if len(rows) != 1 || rows[0] != "1000000000 1.000000000000 100000" {
		t.Fatalf("trades = %v", rows)
	}
}

func TestMovementsBeforeApplication_S546(t *testing.T) {
	t.Parallel()
	f := newReviewFixture(t)
	inv := f.serve(
		"1000.00", "2026-06-10",
		pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"),
		pluggyMove("m-income", "INTEREST", "2026-02-10", "12.34"),
		pluggyMove("m-more", "BUY", "2026-03-10", "200.00"),
		pluggyMove("m-sell", "SELL", "2026-06-10", "500.00"),
	)
	income := inv.movement(t, "income", "2026-02-10")

	for _, id := range []string{
		inv.movement(t, "buy", "2026-03-10").ID,
		inv.movement(t, "sell", "2026-06-10").ID,
		income.ID,
	} {
		f.h.ExpectProblem(
			f.act(f.client, id, "confirm", map[string]any{}),
			http.StatusConflict,
			"investment_not_applied",
			"",
		)
	}

	f.must(inv.movement(t, "buy", "2026-01-10").ID, "confirm", f.applyBody())

	f.h.ExpectProblem(
		f.act(f.client, income.ID, "confirm", map[string]any{}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"category_id",
	)

	got := f.must(income.ID, "confirm", f.incomeBody())
	if got.State != "confirmed" || got.TransactionID == "" {
		t.Fatalf("income = %+v", got)
	}

	rows := f.h.Rows(`SELECT income_type, gross, withheld FROM ledger_investment_income`)
	if len(rows) != 1 || rows[0] != "interest 1234 0" {
		t.Fatalf("incomes = %v", rows)
	}
}

func TestConfirmSaleWithTax_S547(t *testing.T) {
	t.Parallel()
	f := newReviewFixture(t)
	inv := f.serve(
		"500.00", "2026-06-11",
		pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"),
		pluggyMove("m-sell", "SELL", "2026-06-10", "500.00"),
		pluggyMove("m-tax", "TAX", "2026-06-11", "3.00"),
	)

	f.must(inv.movement(t, "buy", "2026-01-10").ID, "confirm", f.applyBody())
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument": f.investment().Instrument, "quote_instrument": "BRL",
		"date": "2026-06-10", "value": "1.100000000000",
	}, http.StatusCreated, nil)

	f.must(inv.movement(t, "sell", "2026-06-10").ID, "confirm", map[string]any{})

	rows := f.h.Rows(`SELECT side, quantity, gross, taxes FROM ledger_trade WHERE side = 'sell'`)
	if len(rows) != 1 || rows[0] != "sell 454545455 50000 300" {
		t.Fatalf("sales = %v", rows)
	}

	tax := f.investment().movement(t, "tax", "2026-06-11")
	if tax.State != "confirmed" || tax.Proposal != "tax_of_sale" || tax.TransactionID != "" {
		t.Fatalf("tax = %+v", tax)
	}

	f.h.ExpectProblem(
		f.act(f.client, tax.ID, "confirm", map[string]any{}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"",
	)
}

func TestDismissAndUndo_S548(t *testing.T) {
	t.Parallel()
	f := newReviewFixture(t)
	inv := f.serve(
		"1000.00", "2026-02-10",
		pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"),
		pluggyMove("m-income", "INTEREST", "2026-02-10", "12.34"),
	)
	buy := inv.movement(t, "buy", "2026-01-10")
	income := inv.movement(t, "income", "2026-02-10")

	if got := f.must(income.ID, "dismiss", nil); got.State != "dismissed" {
		t.Fatalf("dismissed = %+v", got)
	}

	if rows := f.h.Rows(`SELECT 1 FROM ledger_investment_income`); len(rows) != 0 {
		t.Fatalf("incomes after dismiss = %v", rows)
	}

	if got := f.must(income.ID, "undo", nil); got.State != "pending" {
		t.Fatalf("undone dismissal = %+v", got)
	}

	f.must(buy.ID, "confirm", f.applyBody())

	confirmed := f.must(income.ID, "confirm", f.incomeBody())
	f.h.ExpectProblem(
		f.act(f.client, buy.ID, "undo", nil),
		http.StatusConflict,
		"later_movement_confirmed",
		"",
	)

	if got := f.must(income.ID, "undo", nil); got.State != "pending" || got.TransactionID != "" {
		t.Fatalf("undone income = %+v", got)
	}

	var voided struct {
		VoidedAt string `json:"voided_at"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/transactions/"+confirmed.TransactionID,
		nil,
		http.StatusOK,
		&voided,
	)

	if voided.VoidedAt == "" {
		t.Fatal("the income transaction is not voided")
	}

	f.must(buy.ID, "undo", nil)

	if got := f.investment(); got.Instrument != "" || got.BrokerageID != "" {
		t.Fatalf("investment after undo = %+v", got)
	}

	f.must(buy.ID, "confirm", f.applyBody())

	if rows := f.h.Rows(`SELECT 1 FROM ledger_trade WHERE side = 'buy'`); len(rows) != 2 {
		t.Fatalf("purchases = %v, want the voided one and the new one", rows)
	}
}

func TestBalancePrice_S549(t *testing.T) {
	t.Parallel()
	f := newReviewFixture(t)
	inv := f.serve("1000.00", "2026-01-10", pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"))
	f.must(inv.movement(t, "buy", "2026-01-10").ID, "confirm", f.applyBody())

	code := f.investment().Instrument
	f.p.AddInvestment(nubankItem, f.cdb("1010.00", "2026-02-10"))
	f.sync()

	query := `SELECT value::text, source FROM marketdata_price WHERE instrument = $1 AND date = $2`

	rows := f.h.Rows(query, code, "2026-02-10")
	if len(rows) != 1 || rows[0] != "1.010000000000 pluggy" {
		t.Fatalf("prices = %v", rows)
	}

	f.p.AddInvestmentTransaction("inv-cdb", pluggyMove("m-new", "INTEREST", "2026-02-11", "5.00"))
	f.p.AddInvestment(nubankItem, f.cdb("1020.00", "2026-02-11"))
	f.sync()

	if rows := f.h.Rows(query, code, "2026-02-11"); len(rows) != 0 {
		t.Fatalf("prices with a pending movement = %v", rows)
	}
}

func TestApplicationTerms_S550(t *testing.T) {
	t.Parallel()

	t.Run("without index", func(t *testing.T) {
		t.Parallel()
		f := newReviewFixture(t)
		inv := f.cdb("1000.00", "2026-01-10")
		inv.Rate, inv.RateType = "", ""
		v := f.serveInvestment(inv, pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"))

		f.must(v.movement(t, "buy", "2026-01-10").ID, "confirm", f.applyBody())

		var terms struct {
			IndexID  string `json:"index_id"`
			SpreadBP int    `json:"spread_bp"`
		}
		f.h.MustDo(
			http.MethodGet, "/api/v1/instruments/"+f.investment().Instrument+"/terms", nil,
			http.StatusOK, &terms,
		)

		if terms.IndexID != "" || terms.SpreadBP != 0 {
			t.Fatalf("terms = %+v", terms)
		}
	})

	t.Run("without maturity", func(t *testing.T) {
		t.Parallel()
		f := newReviewFixture(t)
		inv := f.cdb("1000.00", "2026-01-10")
		inv.Rate, inv.RateType, inv.DueDate = "", "", nil
		v := f.serveInvestment(inv, pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"))
		buy := v.movement(t, "buy", "2026-01-10")

		f.h.ExpectProblem(
			f.act(f.client, buy.ID, "confirm", f.applyBody()),
			http.StatusUnprocessableEntity,
			"contract_invalid",
			"",
		)

		if got := f.investment().movement(t, "buy", "2026-01-10"); got.State != "pending" {
			t.Fatalf("movement = %+v", got)
		}
	})
}

// foreignBook connects the item in the book of c and syncs it.
func (f reviewFixture) foreignBook(t *testing.T, c *http.Client) connectionView {
	t.Helper()

	in := f.integrate(c, "Pluggy other", pluggyClient, pluggySecret)
	conn := f.mustConnect(c, in.ID, nubankItem)

	var booksID int64
	if err := f.h.Pool.QueryRow(
		t.Context(), `SELECT books_id FROM ingestion_connection WHERE id = $1`, conn.ID,
	).Scan(&booksID); err != nil {
		t.Fatal(err)
	}

	if err := f.h.App.Ingestion.SyncConnection(
		t.Context(), booksID, uuid.MustParse(conn.ID),
	); err != nil {
		t.Fatalf("sync: %v", err)
	}

	return conn
}

func TestForeignBaseAndUnmappedSubtype_S551(t *testing.T) {
	t.Parallel()

	t.Run("base USD, brokerage USD", func(t *testing.T) {
		t.Parallel()
		f := newReviewFixture(t)
		usd := f.h.LoginAs("usd@example.com", locale.Locale{Language: "pt", Region: "BR"}, "USD")
		brokerage, cash := brokerageWithCash(f.h, usd, "USD", "USD")

		inv := f.cdb("1000.00", "2026-01-10")
		inv.CurrencyCode = "USD"
		f.p.AddInvestment(nubankItem, inv)
		f.p.AddInvestmentTransaction(
			"inv-cdb", pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"),
		)

		conn := f.foreignBook(t, usd)
		buy := f.investments(usd, conn.ID)[0].movement(t, "buy", "2026-01-10")
		body := map[string]any{"brokerage_id": brokerage, "cash_account_id": cash}

		r := f.act(usd, buy.ID, "confirm", body)
		if r.Status != http.StatusOK {
			t.Fatalf("confirm status %d: %s", r.Status, r.Body)
		}

		var got investmentMovementView
		r.Decode(t, &got)

		var tx apitest.TransactionView
		f.h.Call(usd, http.MethodGet, "/api/v1/transactions/"+got.TransactionID, nil).
			Decode(t, &tx)

		for _, p := range tx.Postings {
			if p.AccountID == cash && p.Amount.Amount != -100000 {
				t.Fatalf("cash posting = %+v", p)
			}
		}
	})

	t.Run("region BR, unmapped subtype", func(t *testing.T) {
		t.Parallel()
		f := newReviewFixture(t)
		inv := f.cdb("1000.00", "2026-01-10")
		inv.Subtype = "CORPORATE_DEBT"
		v := f.serveInvestment(inv, pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"))

		f.h.ExpectProblem(
			f.act(f.client, v.movement(t, "buy", "2026-01-10").ID, "confirm", f.applyBody()),
			http.StatusUnprocessableEntity,
			"contract_invalid",
			"subtype",
		)
	})

	t.Run("region DE, unmapped subtype", func(t *testing.T) {
		t.Parallel()
		f := newReviewFixture(t)
		de := f.h.LoginAs("de@example.com", locale.Locale{Language: "de", Region: "DE"}, "EUR")
		brokerage, cash := brokerageWithCash(f.h, de, "EUR", "EUR")

		inv := f.cdb("1000.00", "2026-01-10")
		inv.Subtype, inv.CurrencyCode = "CORPORATE_DEBT", "EUR"
		f.p.AddInvestment(nubankItem, inv)
		f.p.AddInvestmentTransaction(
			"inv-cdb", pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"),
		)

		conn := f.foreignBook(t, de)
		buy := f.investments(de, conn.ID)[0].movement(t, "buy", "2026-01-10")

		f.h.ExpectProblem(
			f.act(de, buy.ID, "confirm", map[string]any{
				"brokerage_id": brokerage, "cash_account_id": cash,
			}),
			http.StatusUnprocessableEntity,
			"contract_invalid",
			"subtype",
		)
	})
}

func TestReviewByRoleAndBook_S552(t *testing.T) {
	t.Parallel()
	f := newReviewFixture(t)
	inv := f.serve(
		"1000.00", "2026-02-10",
		pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"),
		pluggyMove("m-income", "INTEREST", "2026-02-10", "12.34"),
	)
	buy := inv.movement(t, "buy", "2026-01-10")
	income := inv.movement(t, "income", "2026-02-10")

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	for _, action := range []string{"confirm", "dismiss", "undo"} {
		if r := f.act(reader, buy.ID, action, f.applyBody()); r.Status != http.StatusForbidden {
			t.Fatalf("reader %s = %d: %s", action, r.Status, r.Body)
		}
	}

	writer := f.h.JoinAs("writer@example.com", f.h.OwnerID(), "write")
	if r := f.act(writer, buy.ID, "confirm", f.applyBody()); r.Status != http.StatusOK {
		t.Fatalf("writer confirm = %d: %s", r.Status, r.Body)
	}

	other := f.h.Login("other@example.com")
	for _, action := range []string{"confirm", "dismiss", "undo"} {
		f.h.ExpectProblem(
			f.act(other, income.ID, action, map[string]any{}),
			http.StatusNotFound,
			"not_found",
			"",
		)
	}
}
