package portfolio_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const projectionPath = "/api/v1/portfolio-projection"

type projectionOut struct {
	WithdrawalAge int `json:"withdrawal_age"`
	LastAge       int `json:"last_age"`
	RealReturnBP  int `json:"real_return_bp"`
	InflationBP   int `json:"inflation_bp"`

	WithdrawalReturnBP *int `json:"withdrawal_return_bp"`
	CautiousReturnBP   *int `json:"cautious_return_bp"`
	FavorableReturnBP  *int `json:"favorable_return_bp"`
	GainTaxBP          *int `json:"gain_tax_bp"`

	Withdrawal struct {
		Mode   string `json:"mode"`
		Income int64  `json:"income"`
		RateBP int    `json:"rate_bp"`
	} `json:"withdrawal"`
	Changes  []changeOut `json:"changes"`
	Currency string      `json:"currency"`
	Baseline struct {
		Date  string `json:"date"`
		Value int64  `json:"value"`
	} `json:"baseline"`
}

type changeOut struct {
	Month  string `json:"month"`
	Amount int64  `json:"amount"`
}

func change(month string, amount int64) map[string]any {
	return map[string]any{"month": month, "amount": amount}
}

func projectionBody(changes ...map[string]any) map[string]any {
	return map[string]any{
		"withdrawal_age": 65,
		"last_age":       95,
		"real_return_bp": 400,
		"inflation_bp":   300,
		"withdrawal":     map[string]any{"mode": "income", "income": 500000},
		"changes":        changes,
	}
}

func saveProjection(t *testing.T, h *apitest.Harness, body map[string]any) projectionOut {
	t.Helper()

	var out projectionOut
	h.MustDo(http.MethodPut, projectionPath, body, http.StatusOK, &out)

	return out
}

func readProjection(t *testing.T, h *apitest.Harness) projectionOut {
	t.Helper()

	var out projectionOut
	h.MustDo(http.MethodGet, projectionPath, nil, http.StatusOK, &out)

	return out
}

// fundedFixture holds 8,000.00 in the cash of the brokerage tree since 2026-10-01.
func fundedFixture(t *testing.T, opts ...apitest.Option) fixture {
	t.Helper()

	f := newFixture(t, opts...)
	f.h.Record("2026-10-01", apitest.Posting(f.cash, 800000), apitest.Posting(f.dividends, -800000))
	f.h.Dispatch()

	return f
}

// S713: a first save sets the currency to the base currency and the baseline to the save day and
// the value of the brokerage trees.
func TestS713FirstSaveSetsBaseline(t *testing.T) {
	t.Parallel()
	f := fundedFixture(t)

	got := saveProjection(t, f.h, projectionBody(change("2026-11-01", 100000)))

	if got.Currency != "BRL" || got.Baseline.Date != "2026-11-01" || got.Baseline.Value != 800000 {
		t.Fatalf("first save = %+v, want BRL, 2026-11-01, 800000", got)
	}

	want := projectionOut{WithdrawalAge: 65, LastAge: 95, RealReturnBP: 400, InflationBP: 300}
	want.Withdrawal.Mode, want.Withdrawal.Income = "income", 500000
	want.Changes = []changeOut{{"2026-11-01", 100000}}
	want.Currency, want.Baseline = "BRL", got.Baseline

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("first save = %+v, want %+v", got, want)
	}

	if read := readProjection(t, f.h); !reflect.DeepEqual(read, got) {
		t.Fatalf("read = %+v, want %+v", read, got)
	}
}

// S714: a later save keeps the currency and the baseline, and a mode change keeps one value only.
func TestS714LaterSaveKeepsBaseline(t *testing.T) {
	t.Parallel()
	f := fundedFixture(t)
	first := saveProjection(t, f.h, projectionBody(change("2026-11-01", 100000)))

	f.h.Restart(apitest.Today("2026-12-15"))
	f.h.Record("2026-12-01", apitest.Posting(f.cash, 100000), apitest.Posting(f.dividends, -100000))
	f.h.Dispatch()

	body := projectionBody(change("2026-11-01", 100000), change("2027-01-01", 90000))
	body["withdrawal"] = map[string]any{"mode": "rate", "rate_bp": 400}
	second := saveProjection(t, f.h, body)

	if second.Currency != first.Currency || second.Baseline != first.Baseline {
		t.Fatalf("second save = %+v, want the currency and baseline of %+v", second, first)
	}

	if second.Withdrawal.Mode != "rate" || second.Withdrawal.RateBP != 400 ||
		second.Withdrawal.Income != 0 || len(second.Changes) != 2 {
		t.Fatalf("second save = %+v, want the rate mode and two changes", second)
	}
}

// PJ3: a base currency changed after the first save leaves the currency and the baseline of the
// plan. The ledger locks the base currency once it holds a posting, so the book holds none.
func TestProjectionKeepsCurrencyAfterBaseChange(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	first := saveProjection(t, f.h, projectionBody(change("2026-11-01", 100000)))

	f.h.MustDo(
		http.MethodPut,
		"/api/v1/settings",
		map[string]string{"base_currency": "USD"},
		http.StatusOK,
		nil,
	)

	second := saveProjection(t, f.h, projectionBody(change("2026-11-01", 120000)))

	if first.Currency != "BRL" || second.Currency != "BRL" || second.Baseline != first.Baseline {
		t.Fatalf("second save = %+v, want the currency and baseline of %+v", second, first)
	}

	if read := readProjection(t, f.h); read.Currency != "BRL" || read.Changes[0].Amount != 120000 {
		t.Fatalf("read = %+v, want BRL and the new amount", read)
	}
}

// S715: a save that alters or drops a change before the current month is 422; one that replaces
// the current month and later is stored, ordered by month.
func TestS715PastChangeIsKept(t *testing.T) {
	t.Parallel()
	f := fundedFixture(t)
	saveProjection(t, f.h, projectionBody(change("2026-11-01", 100000), change("2027-01-01", 1)))
	f.h.Restart(apitest.Today("2026-12-15"))

	for name, changes := range map[string][]map[string]any{
		"altered": {change("2026-11-01", 99999), change("2027-01-01", 1)},
		"dropped": {change("2026-12-01", 5)},
		"added":   {change("2026-10-01", 5), change("2026-11-01", 100000)},
	} {
		r := f.h.Do(http.MethodPut, projectionPath, projectionBody(changes...))
		f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "projection_past_change", "")

		if got := readProjection(t, f.h).Changes; len(got) != 2 || got[1].Amount != 1 {
			t.Fatalf("%s: stored changes = %+v, want the first save", name, got)
		}
	}

	got := saveProjection(t, f.h, projectionBody(
		change("2027-03-01", 70000),
		change("2026-12-01", 120000),
		change("2026-11-01", 100000),
	))

	want := []changeOut{{"2026-11-01", 100000}, {"2026-12-01", 120000}, {"2027-03-01", 70000}}
	if !reflect.DeepEqual(got.Changes, want) {
		t.Fatalf("changes = %+v, want %+v", got.Changes, want)
	}
}

// S716: the plan of one member is not read, replaced or deleted by another member of the book,
// nor by a member of another book.
func TestS716PlanBelongsToMember(t *testing.T) {
	t.Parallel()
	f := fundedFixture(t)
	owner := saveProjection(t, f.h, projectionBody(change("2026-11-01", 100000)))
	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	stranger := f.h.LoginMember("stranger@example.com")

	for _, c := range []*http.Client{reader, stranger} {
		f.h.ExpectProblem(f.h.Call(c, http.MethodGet, projectionPath, nil), 404, "not_found", "")
		f.h.ExpectProblem(f.h.Call(c, http.MethodDelete, projectionPath, nil), 404, "not_found", "")
	}

	body := projectionBody(change("2026-11-01", 5))
	if r := f.h.Call(reader, http.MethodPut, projectionPath, body); r.Status != http.StatusOK {
		t.Fatalf("reader save = %d: %s", r.Status, r.Body)
	}

	if got := readProjection(t, f.h); !reflect.DeepEqual(got, owner) {
		t.Fatalf("owner plan = %+v, want %+v", got, owner)
	}

	if r := f.h.Call(reader, http.MethodDelete, projectionPath, nil); r.Status != 204 {
		t.Fatalf("reader delete = %d: %s", r.Status, r.Body)
	}

	if got := readProjection(t, f.h); !reflect.DeepEqual(got, owner) {
		t.Fatalf("owner plan after the delete of the reader = %+v, want %+v", got, owner)
	}
}

// S717: a book with base currency USD saves and reads a plan in USD (X2).
func TestS717PlanInBaseCurrency(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-01"), apitest.As(apitest.ForeignBase()))

	got := saveProjection(t, h, projectionBody(change("2026-11-01", 100000)))
	if got.Currency != "USD" || got.Baseline.Date != "2026-11-01" || got.Baseline.Value != 0 {
		t.Fatalf("save = %+v, want USD, 2026-11-01, 0", got)
	}

	if read := readProjection(t, h); !reflect.DeepEqual(read, got) {
		t.Fatalf("read = %+v, want %+v", read, got)
	}
}

// S719: a save stores the four premises (PJ7), and a later save without them leaves the plan
// without them.
func TestS719PremisesOfPlan(t *testing.T) {
	t.Parallel()
	f := fundedFixture(t)

	body := projectionBody(change("2026-11-01", 100000))
	body["withdrawal_return_bp"] = -100
	body["cautious_return_bp"] = 250
	body["favorable_return_bp"] = 550
	body["gain_tax_bp"] = 1500
	got := saveProjection(t, f.h, body)

	want := got
	want.WithdrawalReturnBP, want.CautiousReturnBP = new(-100), new(250)
	want.FavorableReturnBP, want.GainTaxBP = new(550), new(1500)

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("save = %+v, want the four premises", got)
	}

	if read := readProjection(t, f.h); !reflect.DeepEqual(read, want) {
		t.Fatalf("read = %+v, want %+v", read, want)
	}

	got = saveProjection(t, f.h, projectionBody(change("2026-11-01", 100000)))
	if got.WithdrawalReturnBP != nil || got.CautiousReturnBP != nil ||
		got.FavorableReturnBP != nil || got.GainTaxBP != nil {
		t.Fatalf("save without premises = %+v, want none", got)
	}
}

func TestProjectionInvalid(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-01"))

	many := make([]map[string]any, 41)
	for i := range many {
		many[i] = change(monthOf(i), 1)
	}

	tests := []struct {
		name  string
		patch map[string]any
	}{
		{"age 17", map[string]any{"withdrawal_age": 17}},
		{"last age equals withdrawal age", map[string]any{"last_age": 65}},
		{"last age 121", map[string]any{"last_age": 121}},
		{"real return 3001", map[string]any{"real_return_bp": 3001}},
		{"inflation -1", map[string]any{"inflation_bp": -1}},
		{"withdrawal return 3001", map[string]any{"withdrawal_return_bp": 3001}},
		{"cautious equals the plan", map[string]any{"cautious_return_bp": 400}},
		{"favorable equals the plan", map[string]any{"favorable_return_bp": 400}},
		{"gain tax 0", map[string]any{"gain_tax_bp": 0}},
		{
			"income mode without income",
			map[string]any{"withdrawal": map[string]any{"mode": "income"}},
		},
		{"rate 0", map[string]any{"withdrawal": map[string]any{"mode": "rate", "rate_bp": 0}}},
		{"no change", map[string]any{"changes": []map[string]any{}}},
		{"41 changes", map[string]any{"changes": many}},
		{"change on day 2", map[string]any{"changes": []map[string]any{change("2026-11-02", 1)}}},
		{"one month twice", map[string]any{"changes": []map[string]any{
			change("2026-11-01", 1), change("2026-11-01", 2),
		}}},
		{"amount -1", map[string]any{"changes": []map[string]any{change("2026-11-01", -1)}}},
	}

	for _, tt := range tests {
		body := projectionBody(change("2026-11-01", 1))
		for k, v := range tt.patch {
			body[k] = v
		}

		r := h.Do(http.MethodPut, projectionPath, body)
		h.ExpectProblem(r, http.StatusUnprocessableEntity, "projection_invalid", "")
	}

	h.ExpectProblem(h.Do(http.MethodGet, projectionPath, nil), 404, "not_found", "")
}

func TestProjectionErrors(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	f.h.ExpectProblem(f.h.Do(http.MethodGet, projectionPath, nil), 404, "not_found", "")
	f.h.ExpectProblem(f.h.Do(http.MethodDelete, projectionPath, nil), 404, "not_found", "")

	anonymous := &http.Client{}
	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		if r := f.h.Call(
			anonymous,
			method,
			projectionPath,
			nil,
		); r.Status != http.StatusUnauthorized {
			t.Fatalf("%s without a session = %d, want 401", method, r.Status)
		}
	}

	r := f.h.Do(http.MethodPut, projectionPath, "not a plan")
	f.h.ExpectProblem(r, http.StatusBadRequest, "invalid_request", "")

	f.trade(t, "buy", "2026-10-10", 10, "10.00", 0)
	f.h.Dispatch()

	r = f.h.Do(http.MethodPut, projectionPath, projectionBody(change("2026-11-01", 1)))
	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "price_missing", "")
	f.h.ExpectProblem(f.h.Do(http.MethodGet, projectionPath, nil), 404, "not_found", "")
}

func TestProjectionDelete(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	saveProjection(t, f.h, projectionBody(change("2026-11-01", 1)))

	if r := f.h.Do(http.MethodDelete, projectionPath, nil); r.Status != http.StatusNoContent {
		t.Fatalf("delete = %d: %s", r.Status, r.Body)
	}

	f.h.ExpectProblem(f.h.Do(http.MethodGet, projectionPath, nil), 404, "not_found", "")

	if rows := f.h.Rows(`SELECT count(*)::text FROM portfolio_projection_change`); rows[0] != "0" {
		t.Fatalf("changes left after the delete: %v", rows)
	}
}

func monthOf(i int) string {
	return []string{"2026", "2027", "2028", "2029"}[i/12] + "-" +
		[]string{
			"01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12",
		}[i%12] + "-01"
}
