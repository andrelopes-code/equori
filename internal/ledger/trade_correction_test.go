package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type tradeVersions struct {
	Items []struct {
		Version     int     `json:"version"`
		Reason      string  `json:"reason"`
		Transaction tradeTx `json:"transaction"`
	} `json:"items"`
}

func TestS415TradeCorrection(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	gains := systemAccount(t, f.h, "realized_gains")
	buy := f.trade(t, "buy", "2026-10-05", 150, "10.05", 490)

	var corrected tradeTx
	f.h.MustDo(
		http.MethodPut,
		"/api/v1/trades/"+buy.ID,
		f.tradeCorrection(buy.Version, "price", "buy", "2026-10-05", 150, "10.00", 490),
		http.StatusOK,
		&corrected,
	)

	if corrected.ID != buy.ID || corrected.Version != 2 || corrected.Trade == nil ||
		corrected.Trade.UnitPrice != "10" || corrected.Trade.Gross["amount"] != float64(150000) {
		t.Fatalf("corrected buy = %+v %+v", corrected, corrected.Trade)
	}

	expectPostings(
		t,
		corrected.Postings,
		[3]any{f.cash, int64(-150490), int64(-150490)},
		[3]any{f.mxrf11, int64(150), int64(150490)},
	)

	var versions tradeVersions
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/transactions/"+buy.ID+"/versions",
		nil,
		http.StatusOK,
		&versions,
	)

	if len(versions.Items) != 1 || versions.Items[0].Reason != "price" ||
		versions.Items[0].Transaction.Trade == nil ||
		versions.Items[0].Transaction.Trade.UnitPrice != "10.05" {
		t.Fatalf("versions = %+v", versions)
	}

	// IC6: the sale reads the holding without its own postings.
	sale := f.trade(t, "sell", "2026-10-20", 50, "10.80", 210)

	var all tradeTx
	f.h.MustDo(
		http.MethodPut,
		"/api/v1/trades/"+sale.ID,
		f.tradeCorrection(sale.Version, "quantity", "sell", "2026-10-20", 150, "10.80", 210),
		http.StatusOK,
		&all,
	)

	if all.Trade == nil || all.Trade.Cost["amount"] != float64(150490) {
		t.Fatalf("corrected sale = %+v", all.Trade)
	}

	expectPostings(
		t,
		all.Postings,
		[3]any{f.cash, int64(161790), int64(161790)},
		[3]any{f.mxrf11, int64(-150), int64(-150490)},
		[3]any{gains, int64(-11300), int64(-11300)},
	)

	// IC5: the buy sits before a sale.
	f.h.ExpectProblem(
		f.h.Do(
			http.MethodPut,
			"/api/v1/trades/"+buy.ID,
			f.tradeCorrection(2, "again", "buy", "2026-10-05", 150, "10.05", 490),
		),
		http.StatusConflict,
		"later_sale_exists",
		"",
	)
}

func TestTradeCorrectionRefusals(t *testing.T) {
	t.Parallel()
	f := newIncomeFixture(t)
	h := f.h
	buy := f.trade(t, "buy", "2026-10-05", 10, "10", 0)
	dividend := f.income(t, f.dividend("2026-10-26", 1200, 0))
	plain := h.Account("Groceries", "expense", "", nil)

	var groceries idOnly
	h.MustDo(http.MethodPost, "/api/v1/transactions", map[string]any{
		"date": "2026-10-06",
		"postings": []map[string]any{
			apitest.Posting(f.nubank, -500),
			apitest.Posting(plain, 500),
		},
	}, http.StatusCreated, &groceries)

	order := f.tradeCorrection(1, "fix", "buy", "2026-10-05", 10, "9", 0)

	cases := []struct {
		name, path  string
		body        map[string]any
		status      int
		code, field string
	}{
		{"stale version", "/api/v1/trades/" + buy.ID,
			f.tradeCorrection(2, "fix", "buy", "2026-10-05", 10, "9", 0),
			http.StatusConflict, "version_conflict", ""},
		{"empty reason", "/api/v1/trades/" + buy.ID,
			f.tradeCorrection(1, "", "buy", "2026-10-05", 10, "9", 0),
			http.StatusUnprocessableEntity, "validation_failed", "reason"},
		{"trade path on an income", "/api/v1/trades/" + dividend.ID, order,
			http.StatusNotFound, "not_found", ""},
		{"trade path on a plain transaction", "/api/v1/trades/" + groceries.ID, order,
			http.StatusNotFound, "not_found", ""},
		{"income path on a trade", "/api/v1/investment-income/" + buy.ID,
			f.incomeCorrection(1, "fix", f.dividend("2026-10-26", 1500, 0)),
			http.StatusNotFound, "not_found", ""},
		{"sale above the holding", "/api/v1/trades/" + buy.ID,
			f.tradeCorrection(1, "fix", "sell", "2026-10-05", 10, "9", 0),
			http.StatusUnprocessableEntity, "validation_failed", "quantity"},
	}
	for _, c := range cases {
		r := h.Do(http.MethodPut, c.path, c.body)
		if r.Status != c.status {
			t.Fatalf("%s: status %d, want %d: %s", c.name, r.Status, c.status, r.Body)
		}

		h.ExpectProblem(r, c.status, c.code, c.field)
	}

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	h.ExpectProblem(
		h.Call(reader, http.MethodPut, "/api/v1/trades/"+buy.ID, order),
		http.StatusForbidden,
		"book_role_required",
		"",
	)

	other := h.Login("other@example.com")
	h.ExpectProblem(
		h.Call(other, http.MethodPut, "/api/v1/trades/"+buy.ID, order),
		http.StatusNotFound,
		"not_found",
		"",
	)

	h.MustDo(
		http.MethodPost,
		"/api/v1/transactions/"+buy.ID+"/void",
		map[string]string{"reason": "duplicate"},
		http.StatusOK,
		nil,
	)
	h.ExpectProblem(
		h.Do(http.MethodPut, "/api/v1/trades/"+buy.ID, order),
		http.StatusConflict,
		"transaction_voided",
		"",
	)

	var read tradeTx
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+buy.ID, nil, http.StatusOK, &read)

	if read.Version != 1 || read.Trade.UnitPrice != "10" {
		t.Fatalf("refused corrections changed the trade: %+v", read)
	}
}

func TestS416IncomeCorrection(t *testing.T) {
	t.Parallel()
	f := newIncomeFixture(t)
	dividend := f.income(t, f.dividend("2026-10-26", 1200, 0))

	var corrected incomeTx
	f.h.MustDo(
		http.MethodPut,
		"/api/v1/investment-income/"+dividend.ID,
		f.incomeCorrection(dividend.Version, "gross", f.dividend("2026-10-26", 1500, 100)),
		http.StatusOK,
		&corrected,
	)

	if corrected.ID != dividend.ID || corrected.Version != 2 || corrected.Income == nil ||
		corrected.Income.Gross["amount"] != float64(1500) ||
		corrected.Income.Withheld["amount"] != float64(100) {
		t.Fatalf("corrected income = %+v %+v", corrected, corrected.Income)
	}

	expectPostings(
		t,
		corrected.Postings,
		[3]any{f.cash, int64(1400), int64(1400)},
		[3]any{f.incomeTax, int64(100), int64(100)},
		[3]any{f.dividends, int64(-1500), int64(-1500)},
	)
}

func (f investFixture) tradeCorrection(
	version int,
	reason, side, date string,
	quantity int64,
	price string,
	fees int64,
) map[string]any {
	trade := map[string]any{
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"side":            side,
		"date":            date,
		"quantity":        units(quantity, "MXRF11"),
		"unit_price":      price,
	}
	if fees != 0 {
		trade["fees"] = apitest.BRL(fees)
	}

	return map[string]any{"expected_version": version, "reason": reason, "trade": trade}
}

func (f incomeFixture) incomeCorrection(
	version int,
	reason string,
	income map[string]any,
) map[string]any {
	return map[string]any{"expected_version": version, "reason": reason, "income": income}
}

func (f incomeFixture) dividend(date string, gross, withheld int64) map[string]any {
	body := map[string]any{
		"account_id":      f.mxrf11,
		"cash_account_id": f.cash,
		"income_type":     "dividend",
		"date":            date,
		"gross":           apitest.BRL(gross),
		"category_id":     f.dividends,
	}
	if withheld != 0 {
		body["withheld"] = apitest.BRL(withheld)
		body["withheld_category_id"] = f.incomeTax
	}

	return body
}
