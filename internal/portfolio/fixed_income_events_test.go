package portfolio_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const fiCode = "CDBFI4B"

type eventOut struct {
	AccountID   string  `json:"account_id"`
	Instrument  string  `json:"instrument"`
	Date        string  `json:"date"`
	Kind        string  `json:"kind"`
	Quantity    amount  `json:"quantity"`
	Gross       *amount `json:"gross"`
	RateMissing bool    `json:"rate_missing"`
	State       string  `json:"state"`
}

type amount struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

type eventRow struct {
	Date     string
	Kind     string
	Quantity int64
	Gross    int64
	State    string
}

type fiFixture struct {
	fixture
	account string
}

// newFIFixture holds 10.000000 units of the pre-fixed contract of A236 FI4 bought on 2026-01-05.
func newFIFixture(t *testing.T, today string, terms map[string]any) fiFixture {
	t.Helper()

	f := newFixture(t, apitest.Today(today))
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code":           fiCode,
		"type":           "fixed_income",
		"scale":          6,
		"name":           fiCode,
		"quote_currency": "BRL",
	}, http.StatusCreated, nil)

	body := map[string]any{
		"issued_on":             "2026-01-05",
		"matures_on":            "2027-01-05",
		"spread_bp":             1200,
		"day_count":             "bus252",
		"calendar_id":           "weekend",
		"face_value":            100000,
		"interest_every_months": 6,
		"first_payment_on":      "2026-07-06",
	}
	for k, v := range terms {
		body[k] = v
	}

	for k, v := range body {
		if v == nil {
			delete(body, k)
		}
	}

	f.h.MustDo(http.MethodPut, "/api/v1/instruments/"+fiCode+"/terms", body, http.StatusOK, nil)

	account := f.h.Account("XP CDB", "asset", "brokerage", map[string]any{
		"institution_id": f.institution,
		"parent_id":      f.xp,
		"currency":       fiCode,
	})
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      account,
		"cash_account_id": f.cash,
		"side":            "buy",
		"date":            "2026-01-05",
		"quantity":        units(10000000, fiCode),
		"unit_price":      "1000.00",
	}, http.StatusCreated, nil)
	f.h.Dispatch()

	return fiFixture{fixture: f, account: account}
}

func (f fiFixture) events(t *testing.T, from, to string) []eventOut {
	t.Helper()

	var out struct {
		Items []eventOut `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/fixed-income-events?from="+from+"&to="+to,
		nil,
		http.StatusOK,
		&out,
	)

	return out.Items
}

func rowsOf(es []eventOut) []eventRow {
	rows := make([]eventRow, len(es))
	for i, e := range es {
		rows[i] = eventRow{Date: e.Date, Kind: e.Kind, Quantity: e.Quantity.Amount, State: e.State}
		if e.Gross != nil {
			rows[i].Gross = e.Gross.Amount
		}
	}

	return rows
}

func TestS510EventsAhead(t *testing.T) {
	t.Parallel()
	f := newFIFixture(t, "2026-06-30", nil)

	es := f.events(t, "2026-06-01", "2027-02-01")

	want := []eventRow{
		{"2026-07-06", "interest", 10000000, 60206, "upcoming"},
		{"2027-01-05", "interest", 10000000, 60683, "upcoming"},
		{"2027-01-05", "maturity", 10000000, 1000000, "upcoming"},
	}
	if got := rowsOf(es); !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}

	for _, e := range es {
		if e.AccountID != f.account || e.Instrument != fiCode || e.Gross.Currency != "BRL" ||
			e.Quantity.Currency != fiCode || e.RateMissing {
			t.Errorf("event = %+v", e)
		}
	}
}

func TestS511EventDue(t *testing.T) {
	t.Parallel()
	f := newFIFixture(t, "2026-07-08", nil)

	es := f.events(t, "2026-06-01", "2027-02-01")

	if len(es) != 3 || es[0].Kind != "interest" || es[0].Date != "2026-07-06" ||
		es[0].State != "due" || es[1].State != "upcoming" {
		t.Fatalf("events = %+v", rowsOf(es))
	}
}

func TestS512EventRecorded(t *testing.T) {
	t.Parallel()
	f := newFIFixture(t, "2026-07-10", nil)
	f.h.MustDo(http.MethodPost, "/api/v1/investment-income", map[string]any{
		"account_id":      f.account,
		"cash_account_id": f.cash,
		"income_type":     "coupon",
		"date":            "2026-07-09",
		"gross":           apitest.BRL(60206),
		"category_id":     f.dividends,
	}, http.StatusCreated, nil)
	f.h.Dispatch()

	es := f.events(t, "2026-06-01", "2027-02-01")

	if len(es) != 3 || es[0].State != "recorded" || es[1].State != "upcoming" {
		t.Fatalf("events = %+v", rowsOf(es))
	}
}

func TestS513EventAmortization(t *testing.T) {
	t.Parallel()
	f := newFIFixture(t, "2026-06-30", map[string]any{
		"payments": []map[string]any{
			{"pays_on": "2026-07-06", "amortization_bp": 5000, "pays_interest": false},
		},
	})

	got := rowsOf(f.events(t, "2026-06-01", "2027-02-01"))

	want := []eventRow{
		{"2026-07-06", "interest", 10000000, 60206, "upcoming"},
		{"2026-07-06", "amortization", 5000000, 500000, "upcoming"},
		{"2027-01-05", "interest", 5000000, 30341, "upcoming"},
		{"2027-01-05", "maturity", 5000000, 500000, "upcoming"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}
}

func TestS514EventRateMissing(t *testing.T) {
	t.Parallel()
	f := newFIFixture(t, "2026-01-20", map[string]any{
		"matures_on":            "2026-01-30",
		"index_id":              "cdi",
		"percent_of_index_bp":   11000,
		"spread_bp":             0,
		"interest_every_months": nil,
		"first_payment_on":      nil,
		"payments": []map[string]any{
			{"pays_on": "2026-01-12", "amortization_bp": 0, "pays_interest": true},
			{"pays_on": "2026-01-30", "amortization_bp": 0, "pays_interest": true},
		},
	})

	for _, d := range []string{"2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"} {
		if _, err := f.h.Pool.Exec(
			t.Context(),
			`INSERT INTO marketdata_index_rate (index_id, date, rate, source)
			 VALUES ('cdi', $1, 0.00055131, 'test')`,
			d,
		); err != nil {
			t.Fatal(err)
		}
	}

	es := f.events(t, "2026-01-01", "2026-02-01")

	if len(es) == 0 || es[0].Kind != "interest" || es[0].Gross != nil || !es[0].RateMissing {
		t.Fatalf("events = %+v", es)
	}
}

func TestS515EventsRangeLimit(t *testing.T) {
	t.Parallel()
	f := newFIFixture(t, "2026-06-30", nil)

	f.h.ExpectProblem(
		f.h.Do(http.MethodGet, "/api/v1/fixed-income-events?from=2026-01-01&to=2027-02-06", nil),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"to",
	)

	var ok struct{}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/fixed-income-events?from=2026-01-01&to=2027-02-05",
		nil,
		http.StatusOK,
		&ok,
	)
}

func TestS516EventsOfAnotherBook(t *testing.T) {
	t.Parallel()
	f := newFIFixture(t, "2026-06-30", nil)
	other := f.h.LoginAs("other@example.com", locale.Locale{Language: "pt", Region: "BR"}, "BRL")

	r := f.h.Call(
		other,
		http.MethodGet,
		"/api/v1/fixed-income-events?from=2026-06-01&to=2027-02-01",
		nil,
	)
	if r.Status != http.StatusOK || string(r.Body) != "{\"items\":[]}\n" &&
		string(r.Body) != "{\"items\":[]}" {
		t.Fatalf("other book = %d: %s", r.Status, r.Body)
	}
}

func TestEventOfAContractWithoutPayments(t *testing.T) {
	t.Parallel()
	f := newFIFixture(t, "2026-07-08", map[string]any{
		"matures_on":            "2026-07-06",
		"interest_every_months": nil,
		"first_payment_on":      nil,
	})
	f.h.App.Marketdata.TickAccrual(t.Context())

	got := rowsOf(f.events(t, "2026-07-01", "2026-07-31"))

	want := []eventRow{{"2026-07-06", "maturity", 10000000, 1060206, "due"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}
}
