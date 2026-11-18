package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S623 (listed options design O2, O3, W1 to W3): a call bought and expired leaves the holding,
// and its premium becomes a realized loss.
func TestS623OptionExpires(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("PETRK300", "option"),
		http.StatusCreated,
		nil,
	)
	option := f.buyOption(t, "PETRK300", 100, "0.50")
	t.Cleanup(func() {
		if t.Failed() {
			t.Log(f.h.Logs())
		}
	})

	var expiry tradeTx
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": option,
		"side":       "write_off",
		"date":       "2026-11-16",
		"quantity":   units(100, "PETRK300"),
	}, http.StatusCreated, &expiry)

	losses := f.h.Rows(
		`SELECT id::text FROM ledger_account WHERE system_role = 'realized_losses'`,
	)[0]
	expectPostings(
		t,
		expiry.Postings,
		[3]any{option, int64(-100), int64(-5000)},
		[3]any{losses, int64(5000), int64(5000)},
	)

	// The table refuses a write-off that brought proceeds.
	if _, err := f.h.Pool.Exec(
		t.Context(),
		`UPDATE ledger_trade SET gross = 100 WHERE transaction_id = $1`,
		expiry.ID,
	); err == nil {
		t.Error("a write-off with gross 100: no error, want a check violation")
	}

	// A write-off takes no price and no more than the units held.
	for _, bad := range []map[string]any{
		{"account_id": option, "side": "write_off", "date": "2026-11-17", "quantity": units(1, "PETRK300")},
		{"account_id": option, "side": "write_off", "date": "2026-11-15", "quantity": units(10, "PETRK300"), "unit_price": "0.10"},
	} {
		f.h.ExpectProblem(
			f.h.Do(http.MethodPost, "/api/v1/trades", bad),
			http.StatusUnprocessableEntity,
			"validation_failed",
			"",
		)
	}
}

// S624 (O4): a call exercised turns into the underlying at the strike plus the premium.
func TestS624CallExercised(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("PETRK300", "option"),
		http.StatusCreated,
		nil,
	)
	option := f.buyOption(t, "PETRK300", 100, "0.50")

	var exercise actionTx
	f.h.MustDo(http.MethodPost, "/api/v1/corporate-actions", map[string]any{
		"account_id":     option,
		"kind":           "right_exercise",
		"date":           "2026-11-16",
		"ratio_from":     1,
		"ratio_to":       1,
		"new_instrument": "PETR4",
		"amount":         apitest.BRL(300000),
	}, http.StatusCreated, &exercise)

	expectPostings(
		t,
		exercise.Postings,
		[3]any{option, int64(-100), int64(-5000)},
		[3]any{f.petr4, int64(100), int64(305000)},
		[3]any{f.cash, int64(-300000), int64(-300000)},
	)
}

// S625 (O3): a right left unexercised is written off with no result, since it cost nothing.
func TestS625RightWrittenOff(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("PETR12", "stock"),
		http.StatusCreated,
		nil,
	)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	f.h.MustDo(http.MethodPost, "/api/v1/corporate-actions", map[string]any{
		"account_id":     f.petr4,
		"kind":           "right_issue",
		"date":           "2026-11-10",
		"ratio_from":     10,
		"ratio_to":       1,
		"new_instrument": "PETR12",
	}, http.StatusCreated, nil)
	rights := holdingOf(t, f, "PETR12")

	var lapse tradeTx
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": rights,
		"side":       "write_off",
		"date":       "2026-11-20",
		"quantity":   units(10, "PETR12"),
	}, http.StatusCreated, &lapse)

	expectPostings(t, lapse.Postings, [3]any{rights, int64(-10), int64(0)})
}

// buyOption buys quantity units of code at price from the cash account of the fixture.
func (f investFixture) buyOption(t *testing.T, code string, quantity int64, price string) string {
	t.Helper()

	account := f.h.Account("XP "+code, "asset", "brokerage", map[string]any{
		"institution_id": f.institution,
		"parent_id":      f.xp,
		"currency":       code,
	})
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      account,
		"cash_account_id": f.cash,
		"side":            "buy",
		"date":            "2026-11-03",
		"quantity":        units(quantity, code),
		"unit_price":      price,
	}, http.StatusCreated, nil)

	return account
}

// Listed options design S4: record_investment writes off an option at expiry.
func TestWriteOffTool(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("PETRK300", "option"),
		http.StatusCreated,
		nil,
	)
	option := f.buyOption(t, "PETRK300", 100, "0.50")

	args := map[string]any{
		"kind": "write_off", "account_id": option, "date": "2026-11-16", "quantity": "100",
	}

	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)

	var tx tradeTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+out.TransactionID, nil, http.StatusOK, &tx)

	if len(tx.Postings) != 2 {
		t.Errorf("postings = %+v, want the holding out and the loss", tx.Postings)
	}

	args["unit_price"] = "0.10"
	if r := f.h.Tool("record_investment", args); !r.IsError {
		t.Errorf("write_off with a price = %s, want an error", r.Content)
	}
}
