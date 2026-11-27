package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type openingFixture struct {
	h        *apitest.Harness
	xp, cash string
}

// S753 (investment history OL1, OL3, OL4, OL8): units held before the book enter at their cost
// against the opening balances, with no cash, and the brokerage opens on the acquisition date.
func TestS753OpeningOfAStock(t *testing.T) {
	t.Parallel()

	for _, pr := range apitest.Profiles() {
		t.Run(pr.Name, func(t *testing.T) {
			t.Parallel()
			f := newOpeningFixture(t, pr)

			var tx tradeTx
			f.h.MustDo(
				http.MethodPost,
				"/api/v1/trades",
				f.openingBody("2021-03-10", 100, "20.00", 500),
				http.StatusCreated,
				&tx,
			)

			holding := openedHolding(t, tx, "PETR4")
			wantSums := map[string]string{
				holding: "100 200500",
				f.cash:  "0 0",
			}

			for account, want := range wantSums {
				got := f.h.Rows(
					`SELECT coalesce(sum(amount), 0)::text, coalesce(sum(weight), 0)::text
					FROM ledger_posting WHERE account_id = $1`,
					account,
				)
				if len(got) != 1 || got[0] != want {
					t.Errorf("sums of %s = %v, want %q", account, got, want)
				}
			}

			equity := f.h.Rows(
				`SELECT coalesce(sum(p.weight), 0)::text FROM ledger_posting p
				JOIN ledger_account a ON a.id = p.account_id
				WHERE a.system_role = 'opening_balances'`,
			)
			if len(equity) != 1 || equity[0] != "-200500" {
				t.Errorf("opening balances = %v, want -200500", equity)
			}

			for _, id := range []string{f.xp, holding} {
				var acc struct {
					OpenedOn string `json:"opened_on"`
				}
				f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+id, nil, http.StatusOK, &acc)

				if acc.OpenedOn != "2021-03-10" {
					t.Errorf("opened_on of %s = %s, want 2021-03-10", id, acc.OpenedOn)
				}
			}
		})
	}
}

// S754 (OL2): a sale after an opening removes the average cost of the position.
func TestS754SaleAfterOpening(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": f.petr4,
		"side":       "opening",
		"date":       "2021-03-10",
		"quantity":   units(100, "PETR4"),
		"unit_price": "20.00",
		"fees":       apitest.BRL(500),
	}, http.StatusCreated, nil)

	sale := f.petr4Day(t, "sell", "2026-11-20", 40, "30.00")

	if sale.Trade.Cost["amount"] != float64(80200) {
		t.Errorf("cost = %v, want 80200", sale.Trade.Cost)
	}

	gains := f.h.Rows(
		`SELECT coalesce(sum(p.weight), 0)::text FROM ledger_posting p
		JOIN ledger_account a ON a.id = p.account_id
		WHERE a.system_role = 'realized_gains'`,
	)
	if len(gains) != 1 || gains[0] != "-39800" {
		t.Errorf("realized gains = %v, want -39800 (a result of 398.00)", gains)
	}
}

// S755 (OL3): an opening takes no cash account, taxes, settlement or zero price, and a brokerage
// note refuses it.
func TestS755OpeningRefusals(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)

	tests := []struct {
		name  string
		field string
		set   map[string]any
	}{
		{"cash account", "cash_account_id", map[string]any{"cash_account_id": f.cash}},
		{"taxes", "taxes", map[string]any{"taxes": apitest.BRL(100)}},
		{"settlement", "settlement_date", map[string]any{"settlement_date": "2021-03-12"}},
		{"zero price", "unit_price", map[string]any{"unit_price": "0"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := map[string]any{
				"brokerage_id": f.xp,
				"instrument":   "PETR4",
				"side":         "opening",
				"date":         "2021-03-10",
				"quantity":     units(100, "PETR4"),
				"unit_price":   "20.00",
			}
			for k, v := range tt.set {
				body[k] = v
			}

			f.h.ExpectProblem(
				f.h.Do(http.MethodPost, "/api/v1/trades", body),
				http.StatusUnprocessableEntity,
				"validation_failed",
				tt.field,
			)
		})
	}

	t.Run("brokerage note", func(t *testing.T) {
		f.h.ExpectProblem(
			f.h.Do(
				http.MethodPost,
				notesPath,
				f.noteBody("2026-11-10", 0, 0, f.noteOrder("opening", "PETR4", 100, "30.00")),
			),
			http.StatusUnprocessableEntity,
			"validation_failed",
			"",
		)
	})
}

// S756 (OL5): an opening dated like a sale counts as a purchase of its date.
func TestS756DayTradeWithOpening(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", security("VALE3", "stock"),
		http.StatusCreated, nil)
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"brokerage_id": f.xp,
		"instrument":   "VALE3",
		"side":         "opening",
		"date":         "2026-11-20",
		"quantity":     units(10, "VALE3"),
		"unit_price":   "10.00",
	}, http.StatusCreated, nil)

	var sale dayTradeTx
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"brokerage_id":    f.xp,
		"instrument":      "VALE3",
		"cash_account_id": f.cash,
		"side":            "sell",
		"date":            "2026-11-20",
		"quantity":        units(10, "VALE3"),
		"unit_price":      "11.00",
	}, http.StatusCreated, &sale)

	if sale.Trade.DayTradeQuantity["amount"] != float64(10) {
		t.Errorf("day_trade_quantity = %v, want 10", sale.Trade.DayTradeQuantity)
	}
}

// S757 (OL6): the return counts an opening as a deposit of its cost on its date.
func TestS757ReturnCountsOpeningAsDeposit(t *testing.T) {
	t.Parallel()
	f := newOpeningFixture(t, apitest.Brazil())
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/trades",
		f.openingBody("2021-03-10", 100, "20.00", 500),
		http.StatusCreated,
		nil,
	)

	for _, date := range []string{"2021-03-10", "2026-11-20"} {
		f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
			"instrument":       "PETR4",
			"quote_instrument": "BRL",
			"date":             date,
			"value":            "20.00",
		}, http.StatusCreated, nil)
	}

	var report struct {
		Flows []struct {
			Date   string         `json:"date"`
			Amount map[string]any `json:"amount"`
		} `json:"flows"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/reports/return?account_id="+f.xp+"&from=2021-03-10&to=2026-11-20",
		nil,
		http.StatusOK,
		&report,
	)

	if len(report.Flows) != 1 || report.Flows[0].Date != "2021-03-10" ||
		report.Flows[0].Amount["amount"] != float64(200500) {
		t.Errorf("flows = %+v, want one of 200500 on 2021-03-10", report.Flows)
	}
}

// S758 (OL7): a fixed income application with opening holds the amount as one lot of its date,
// takes no cash, refuses a cash account and replays by its application id.
func TestS758FixedIncomeOpening(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	body := f.newContractBody("2024-01-10", 1000000)
	body["opening"] = true
	delete(body, "cash_account_id")
	body["contract"].(map[string]any)["matures_on"] = "2028-01-10"

	var out fixedIncomeOut
	f.h.MustDo(http.MethodPost, fixedIncomePath, body, http.StatusCreated, &out)

	cash := f.h.Rows(
		`SELECT coalesce(sum(amount), 0)::text FROM ledger_posting WHERE account_id = $1`,
		f.cash,
	)
	if len(cash) != 1 || cash[0] != "0" {
		t.Errorf("cash sum = %v, want 0", cash)
	}

	holding := f.h.Rows(
		`SELECT account_id::text FROM ledger_trade WHERE transaction_id = $1`,
		out.TransactionID,
	)
	if len(holding) != 1 {
		t.Fatalf("holding = %v, want one trade", holding)
	}

	var lots lotsOut
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/accounts/"+holding[0]+"/lots?date=2026-11-20",
		nil,
		http.StatusOK,
		&lots,
	)

	if lots.Method != "fifo" || len(lots.Lots) != 1 ||
		lots.Lots[0].AcquiredOn != "2024-01-10" ||
		lots.Lots[0].Cost["amount"] != float64(1000000) {
		t.Errorf("lots = %+v, want one fifo lot of 1000000 acquired 2024-01-10", lots)
	}

	var again fixedIncomeOut
	f.h.MustDo(http.MethodPost, fixedIncomePath, body, http.StatusOK, &again)

	if again.TransactionID != out.TransactionID {
		t.Errorf("replay transaction = %s, want %s", again.TransactionID, out.TransactionID)
	}

	body["cash_account_id"] = f.cash
	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, fixedIncomePath, body),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"cash_account_id",
	)
}

// TestTradeOpeningCarriesNoTaxes (OL8): the table refuses taxes, or a cash account other than the
// holding, on an opening.
func TestTradeOpeningCarriesNoTaxes(t *testing.T) {
	t.Parallel()
	f := newOpeningFixture(t, apitest.Brazil())

	var tx tradeTx
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/trades",
		f.openingBody("2021-03-10", 100, "20.00", 0),
		http.StatusCreated,
		&tx,
	)

	for _, stmt := range []string{
		`UPDATE ledger_trade SET taxes = 1 WHERE transaction_id = $1`,
		`UPDATE ledger_trade SET cash_account_id = '` + f.cash + `' WHERE transaction_id = $1`,
	} {
		if _, err := f.h.Pool.Exec(t.Context(), stmt, tx.ID); err == nil {
			t.Errorf("%s: no error, want a check violation", stmt)
		}
	}
}

func newOpeningFixture(t *testing.T, pr apitest.Profile) openingFixture {
	t.Helper()

	h := apitest.New(t, apitest.As(pr))

	instrument := security("PETR4", "stock")
	instrument["quote_currency"] = string(pr.Base)
	h.MustDo(http.MethodPost, "/api/v1/instruments", instrument, http.StatusCreated, nil)

	var inst idOnly
	h.MustDo(
		http.MethodPost,
		"/api/v1/institutions",
		map[string]string{"name": "XP"},
		http.StatusCreated,
		&inst,
	)

	xp := h.Account("XP", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"opened_on":      "2026-11-01",
	})
	cash := h.Account("XP cash", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"parent_id":      xp,
		"opened_on":      "2026-11-01",
	})

	return openingFixture{h: h, xp: xp, cash: cash}
}

func (f openingFixture) openingBody(
	date string,
	quantity int64,
	price string,
	fees int64,
) map[string]any {
	body := map[string]any{
		"brokerage_id": f.xp,
		"instrument":   "PETR4",
		"side":         "opening",
		"date":         date,
		"quantity":     units(quantity, "PETR4"),
		"unit_price":   price,
	}
	if fees != 0 {
		body["fees"] = f.h.Money(fees)
	}

	return body
}

// openedHolding returns the account of the posting of tx in the instrument.
func openedHolding(t *testing.T, tx tradeTx, instrument string) string {
	t.Helper()

	for _, p := range tx.Postings {
		if p.Amount["currency"] == instrument {
			return p.AccountID
		}
	}

	t.Fatalf("no posting in %s: %+v", instrument, tx.Postings)

	return ""
}
