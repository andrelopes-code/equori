package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// Coverage row E-06 (assistant parity design, phase 6): a capital increase gives the holding units
// of a subscription right at no cost; exercising the right turns its units into the subscribed
// security, whose cost is the price paid from the cash account.
func TestRightIssueAndExercise(t *testing.T) {
	t.Parallel()

	f := newInvestFixture(t)
	for _, code := range []string{"PETR12", "PETR10"} {
		f.h.MustDo(
			http.MethodPost,
			"/api/v1/instruments",
			security(code, "stock"),
			http.StatusCreated,
			nil,
		)
	}

	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})

	var issue actionTx
	f.h.MustDo(http.MethodPost, "/api/v1/corporate-actions", map[string]any{
		"account_id":     f.petr4,
		"kind":           "right_issue",
		"date":           "2026-11-10",
		"ratio_from":     10,
		"ratio_to":       1,
		"new_instrument": "PETR12",
	}, http.StatusCreated, &issue)

	petr12 := holdingOf(t, f, "PETR12")
	expectPostings(
		t,
		issue.Postings,
		[3]any{f.petr4, int64(-100), int64(-100000)},
		[3]any{f.petr4, int64(100), int64(100000)},
		[3]any{petr12, int64(10), int64(0)},
	)

	t.Cleanup(func() {
		if t.Failed() {
			t.Log(f.h.Logs())
		}
	})

	// A sale of 4 rights takes no cost out of the holding: the whole price is the gain.
	var sale tradeTx
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      petr12,
		"cash_account_id": f.cash,
		"side":            "sell",
		"date":            "2026-11-15",
		"quantity":        units(4, "PETR12"),
		"unit_price":      "2.00",
	}, http.StatusCreated, &sale)

	// The exercise pays 8.00 for each of the 6 rights left and receives the subscription receipt.
	var exercise actionTx
	f.h.MustDo(http.MethodPost, "/api/v1/corporate-actions", map[string]any{
		"account_id":     petr12,
		"kind":           "right_exercise",
		"date":           "2026-11-20",
		"ratio_from":     1,
		"ratio_to":       1,
		"new_instrument": "PETR10",
		"amount":         apitest.BRL(4800),
	}, http.StatusCreated, &exercise)

	petr10 := holdingOf(t, f, "PETR10")
	expectPostings(
		t,
		exercise.Postings,
		[3]any{petr12, int64(-6), int64(0)},
		[3]any{petr10, int64(6), int64(4800)},
		[3]any{f.cash, int64(-4800), int64(-4800)},
	)

	if exercise.CorporateAction == nil || exercise.CorporateAction.Kind != "right_exercise" {
		t.Errorf("corporate action = %+v, want right_exercise", exercise.CorporateAction)
	}

	// The table refuses an exercise that paid nothing, and a value on a right issue.
	for _, update := range []struct{ sql, id string }{
		{`UPDATE ledger_corporate_action SET value = 0 WHERE transaction_id = $1`, exercise.ID},
		{`UPDATE ledger_corporate_action SET value = 1 WHERE transaction_id = $1`, issue.ID},
	} {
		if _, err := f.h.Pool.Exec(t.Context(), update.sql, update.id); err == nil {
			t.Errorf("%s: no error, want a check violation", update.sql)
		}
	}

	// An exercise pays something; a right issue moves no cost and pays nothing.
	for _, bad := range []map[string]any{
		{"account_id": petr12, "kind": "right_exercise", "date": "2026-11-21", "ratio_from": 1, "ratio_to": 1, "new_instrument": "PETR10"},
		{"account_id": f.petr4, "kind": "right_issue", "date": "2026-11-21", "ratio_from": 10, "ratio_to": 1, "new_instrument": "PETR12", "cost_bp": 100},
		{"account_id": f.petr4, "kind": "right_issue", "date": "2026-11-21", "ratio_from": 10, "ratio_to": 1, "new_instrument": "PETR12", "amount": apitest.BRL(100)},
	} {
		f.h.ExpectProblem(
			f.h.Do(http.MethodPost, "/api/v1/corporate-actions", bad),
			http.StatusUnprocessableEntity,
			"validation_failed",
			"",
		)
	}
}

// An exercise takes every unit held (listed options design O4): a quantity, read only by a unit
// tax (A236 FC25), is refused instead of left unread.
func TestRightExerciseRefusesQuantity(t *testing.T) {
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

	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, "/api/v1/corporate-actions", map[string]any{
			"account_id":     holdingOf(t, f, "PETR12"),
			"kind":           "right_exercise",
			"date":           "2026-11-20",
			"ratio_from":     1,
			"ratio_to":       1,
			"new_instrument": "PETR4",
			"quantity":       units(5, "PETR12"),
			"amount":         apitest.BRL(5000),
		}),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"quantity",
	)
}

// Coverage row E-06: the tool records a right issue and an exercise paid from the cash account of
// the brokerage, and asks for the price of an exercise.
func TestRightExerciseTool(t *testing.T) {
	t.Parallel()

	f := newInvestFixture(t)
	for _, code := range []string{"PETR12", "PETR10"} {
		f.h.MustDo(
			http.MethodPost,
			"/api/v1/instruments",
			security(code, "stock"),
			http.StatusCreated,
			nil,
		)
	}

	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})

	var issued investmentOut
	toolOutput(t, f.h, "record_corporate_action", map[string]any{
		"account_id": f.petr4, "kind": "right_issue", "date": "2026-11-10",
		"ratio_from": 10, "ratio_to": 1, "new_instrument": "PETR12",
	}, &issued)

	petr12 := holdingOf(t, f, "PETR12")
	args := map[string]any{
		"account_id": petr12, "kind": "right_exercise", "date": "2026-11-20",
		"ratio_from": 1, "ratio_to": 1, "new_instrument": "PETR10", "amount": "80.00",
	}

	if p := previewTool(t, f.h, "record_corporate_action", args); p.Action !=
		"record_corporate_action.right_exercise" {
		t.Fatalf("preview = %+v", p)
	}

	var out investmentOut
	toolOutput(t, f.h, "record_corporate_action", args, &out)

	var tx actionTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+out.TransactionID, nil, http.StatusOK, &tx)

	expectPostings(
		t,
		tx.Postings,
		[3]any{petr12, int64(-10), int64(0)},
		[3]any{holdingOf(t, f, "PETR10"), int64(10), int64(8000)},
		[3]any{f.cash, int64(-8000), int64(-8000)},
	)

	delete(args, "amount")

	if r := f.h.Tool("record_corporate_action", args); !r.IsError {
		t.Errorf("right_exercise without amount = %s, want an error", r.Content)
	}
}

// O3, O4: a partial exercise is the write-off of the rights left unexercised before the date of
// the exercise, which takes the rest; on the same date the write-off refuses it (A228 IO16).
func TestPartialExerciseByWriteOff(t *testing.T) {
	t.Parallel()

	f := newInvestFixture(t)
	for _, code := range []string{"PETR12", "PETR10"} {
		f.h.MustDo(
			http.MethodPost,
			"/api/v1/instruments",
			security(code, "stock"),
			http.StatusCreated,
			nil,
		)
	}

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

	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id": rights,
		"side":       "write_off",
		"date":       "2026-11-19",
		"quantity":   units(4, "PETR12"),
	}, http.StatusCreated, nil)

	var exercise actionTx
	f.h.MustDo(http.MethodPost, "/api/v1/corporate-actions", map[string]any{
		"account_id":     rights,
		"kind":           "right_exercise",
		"date":           "2026-11-20",
		"ratio_from":     1,
		"ratio_to":       1,
		"new_instrument": "PETR10",
		"amount":         apitest.BRL(4800),
	}, http.StatusCreated, &exercise)

	expectPostings(
		t,
		exercise.Postings,
		[3]any{rights, int64(-6), int64(0)},
		[3]any{holdingOf(t, f, "PETR10"), int64(6), int64(4800)},
		[3]any{f.cash, int64(-4800), int64(-4800)},
	)
}
