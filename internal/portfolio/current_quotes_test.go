package portfolio_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	answerOK      = "ok"
	answerFailing = "500"
	answerLimited = "429"
	answerBlocked = "blocked"
)

// wantPrice is the price of a position as the API states it; at is empty for a close.
type wantPrice struct {
	value, date, source, at string
	open                    bool
}

var (
	currentQuote = wantPrice{
		value: "9.25", date: "2026-11-03", source: "yahoo_chart",
		at: "2026-11-03T14:58:00Z", open: true,
	}
	lastClose = wantPrice{value: "9.1", date: "2026-10-30", source: "b3_consolidated"}
)

// S557: a position at today of the book takes the current quote (A248 CQ20 to CQ23).
func TestS557PositionsTakeTheCurrentQuote(t *testing.T) {
	t.Parallel()

	f, _ := currentFixture(t, answerOK)

	assertPosition(t, f.positions(t, "2026-11-03"), 92500, currentQuote)
}

// S558: a disabled, failing, rate limited or slow source leaves the close (A248 CQ18).
func TestS558PositionsFallBackToTheClose(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		answer  string
		disable bool
		opts    []apitest.Option
	}{
		{name: "disabled", answer: answerOK, disable: true},
		{name: "failing", answer: answerFailing},
		{name: "rate limited", answer: answerLimited},
		{
			name:   "slow",
			answer: answerBlocked,
			opts:   []apitest.Option{apitest.CurrentBound(50 * time.Millisecond)},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f, _ := currentFixture(t, tt.answer, tt.opts...)
			if tt.disable {
				f.h.MustDo(
					http.MethodPut,
					"/api/v1/market-data/feeds/yahoo_chart",
					map[string]any{"enabled": false},
					http.StatusOK,
					nil,
				)
			}

			assertPosition(t, f.positions(t, "2026-11-03"), 91000, lastClose)
		})
	}
}

// S559: a manual price of today wins over the current quote (A248 CQ20).
func TestS559AManualPriceOfTodayWins(t *testing.T) {
	t.Parallel()

	f, _ := currentFixture(t, answerOK)
	recordMXRF11(t, f, "2026-11-03", "9.00", "manual")

	want := wantPrice{value: "9", date: "2026-11-03", source: "manual"}
	assertPosition(t, f.positions(t, "2026-11-03"), 90000, want)
}

// S560: a read at an earlier date takes the close and asks no source (A248 CQ20).
func TestS560PositionsAtAnEarlierDate(t *testing.T) {
	t.Parallel()

	f, srv := currentFixture(t, answerOK)

	assertPosition(t, f.positions(t, "2026-11-02"), 91000, lastClose)

	if got := srv.requested(); len(got) != 0 {
		t.Errorf("paths requested = %v, want none", got)
	}
}

// S565: the warning of a late close survives a fresh current quote (A248 CQ22).
func TestS565AWarningSurvivesACurrentQuote(t *testing.T) {
	t.Parallel()

	f, _ := currentFixtureWithClose(
		t,
		answerOK,
		"2026-10-20",
		"9.02",
		[]string{"b3_consolidated", "yahoo_chart"},
	)
	f.h.Dispatch()

	var out struct {
		Items    []positionOut     `json:"items"`
		Warnings []quoteWarningOut `json:"quote_warnings"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/positions?date=2026-11-03", nil, http.StatusOK, &out)

	assertPosition(t, out.Items, 92500, currentQuote)

	want := []quoteWarningOut{{Instrument: "MXRF11", Last: ptr("2026-10-20")}}
	if !reflect.DeepEqual(out.Warnings, want) {
		t.Errorf("quote_warnings = %+v, want %+v", out.Warnings, want)
	}
}

// S563: a total at today of the book states the current quotes it took (A248 CQ21, CQ24).
func TestS563TotalsStateTheirCurrentQuotes(t *testing.T) {
	t.Parallel()

	f, _ := currentFixture(t, answerOK)
	want := &currentOut{Count: 1, Open: true, OldestAt: "2026-11-03T14:58:00Z"}

	before := netWorthAt(t, f, "2026-11-02")
	if before.Current != nil {
		t.Errorf("net worth at 2026-11-02 current = %+v, want none", before.Current)
	}

	assets := before.Assets["amount"].(float64)

	today := netWorthAt(t, f, "2026-11-03")
	if today.Assets["amount"] != assets+1500 {
		t.Errorf("assets at 2026-11-03 = %v, want %v", today.Assets["amount"], assets+1500)
	}

	if !reflect.DeepEqual(today.Current, want) {
		t.Errorf("net worth current = %+v, want %+v", today.Current, want)
	}

	if got := allocationAt(t, f, "2026-11-03"); !reflect.DeepEqual(got.Current, want) {
		t.Errorf("allocation current = %+v, want %+v", got.Current, want)
	}

	if got := allocationAt(t, f, "2026-11-02"); got.Current != nil {
		t.Errorf("allocation at 2026-11-02 current = %+v, want none", got.Current)
	}

	var days struct {
		Items []netWorthDayOut `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/reports/net-worth/days?from=2026-11-02&to=2026-11-03",
		nil,
		http.StatusOK,
		&days,
	)

	if len(days.Items) != 2 {
		t.Fatalf("days = %+v, want two", days.Items)
	}

	if days.Items[0].Current != nil || days.Items[0].Assets["amount"] != assets {
		t.Errorf("first day = %+v, want assets %v without current", days.Items[0], assets)
	}

	if days.Items[1].Assets["amount"] != assets+1500 ||
		!reflect.DeepEqual(days.Items[1].Current, want) {
		t.Errorf("second day = %+v, want assets %v with %+v", days.Items[1], assets+1500, want)
	}
}

// S564: a book in another currency values a holding through the current quote of the instrument
// and of the currency, or through the close of the currency when no source reports it (A248 C2,
// C3, X2).
func TestS564ABookInAnotherCurrency(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		answer func(w http.ResponseWriter)
		amount float64
		want   []legOut
	}{
		{
			name: "currency quote",
			answer: func(w http.ResponseWriter) {
				body := currentBody("USD", "Europe/London", "0.1729")
				body = strings.ReplaceAll(body, "1793710800", "1793664000")
				body = strings.ReplaceAll(body, "1793736000", "1793750340")
				_, _ = w.Write([]byte(body))
			},
			amount: 15993,
			want: []legOut{
				{Instrument: "MXRF11", Quote: "BRL", Value: "9.25", At: "2026-11-03T14:58:00Z"},
				{Instrument: "BRL", Quote: "USD", Value: "0.1729", At: "2026-11-03T14:58:00Z"},
			},
		},
		{
			name:   "no currency quote",
			answer: func(w http.ResponseWriter) { w.WriteHeader(http.StatusNotFound) },
			amount: 16818,
			want: []legOut{
				{Instrument: "MXRF11", Quote: "BRL", Value: "9.25", At: "2026-11-03T14:58:00Z"},
				{Instrument: "USD", Quote: "BRL", Value: "5.5"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := foreignBaseFixture(t, tt.answer)

			var out struct {
				Items []struct {
					MarketValue map[string]any `json:"market_value"`
					Prices      []legOut       `json:"prices"`
				} `json:"items"`
			}
			f.h.MustDo(
				http.MethodGet,
				"/api/v1/positions?date=2026-11-03",
				nil,
				http.StatusOK,
				&out,
			)

			if len(out.Items) != 1 {
				t.Fatalf("positions = %+v, want one", out.Items)
			}

			mv := out.Items[0].MarketValue
			if mv["amount"] != tt.amount || mv["currency"] != "USD" {
				t.Errorf("market_value = %+v, want %v USD", mv, tt.amount)
			}

			got := out.Items[0].Prices
			for i := range got {
				got[i].Date, got[i].Source, got[i].Open = "", "", false
			}

			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("prices = %+v, want %+v", got, tt.want)
			}
		})
	}
}

type currentServer struct {
	mu    sync.Mutex
	paths []string
}

func (s *currentServer) requested() []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return append([]string(nil), s.paths...)
}

func currentFixture(
	t *testing.T,
	answer string,
	opts ...apitest.Option,
) (fixture, *currentServer) {
	t.Helper()

	return currentFixtureWithClose(
		t,
		answer,
		"2026-10-30",
		"9.10",
		[]string{"yahoo_chart"},
		opts...,
	)
}

func currentFixtureWithClose(
	t *testing.T,
	answer, closeDate, closeValue string,
	feeds []string,
	opts ...apitest.Option,
) (fixture, *currentServer) {
	t.Helper()

	var (
		rec     = &currentServer{}
		release = make(chan struct{})
		once    sync.Once
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec.mu.Lock()
		rec.paths = append(rec.paths, r.URL.Path)
		rec.mu.Unlock()

		switch answer {
		case answerBlocked:
			select {
			case <-release:
			case <-r.Context().Done():
			}
		case answerFailing:
			w.WriteHeader(http.StatusInternalServerError)
		case answerLimited:
			w.WriteHeader(http.StatusTooManyRequests)
		default:
			if r.URL.Path == "/yahoo/MXRF11.SA" {
				_, _ = w.Write([]byte(currentBody("BRL", "America/Sao_Paulo", "9.25")))
				return
			}

			http.NotFound(w, r)
		}
	}))

	t.Cleanup(srv.Close)
	t.Cleanup(func() { once.Do(func() { close(release) }) })

	all := append([]apitest.Option{
		apitest.Clock(func() time.Time { return time.Date(2026, 11, 3, 15, 13, 0, 0, time.UTC) }),
		apitest.PriceFeeds(feeds, map[string]string{"yahoo_chart": srv.URL + "/yahoo"}),
	}, opts...)

	f := newFixture(t, all...)
	f.trade(t, "buy", "2026-10-05", 100, "10.05", 0)
	f.h.Dispatch()
	recordMXRF11(t, f, closeDate, closeValue, "b3_consolidated")

	return f, rec
}

// currentBody is the chart answer of a session that opened at 13:00 and closes at 20:00 UTC on
// 2026-11-03, with the last trade at 14:58 UTC.
func currentBody(currency, zone, price string) string {
	return fmt.Sprintf(
		`{"chart":{"result":[{"meta":{"currency":"%s","exchangeTimezoneName":"%s",`+
			`"regularMarketPrice":%s,"regularMarketTime":1793717880,`+
			`"currentTradingPeriod":{"regular":{"start":1793710800,"end":1793736000}}},`+
			`"timestamp":[],"indicators":{"quote":[{}]}}]}}`,
		currency, zone, price,
	)
}

func assertPosition(t *testing.T, ps []positionOut, amount float64, want wantPrice) {
	t.Helper()

	if len(ps) != 1 {
		t.Fatalf("positions = %+v, want one", ps)
	}

	mv := ps[0].MarketValue
	if mv["amount"] != amount || mv["currency"] != "BRL" {
		t.Errorf("market_value = %+v, want %v BRL", mv, amount)
	}

	if len(ps[0].Prices) != 1 {
		t.Fatalf("prices = %+v, want one", ps[0].Prices)
	}

	p := ps[0].Prices[0]
	got := wantPrice{value: p.Value, date: p.Date, source: p.Source}

	if p.At != nil {
		got.at = *p.At
	}

	if p.Open != nil {
		got.open = *p.Open
	}

	if want.at == "" && (p.At != nil || p.Open != nil) {
		t.Errorf("close has at = %v, open = %v, want neither", p.At, p.Open)
	}

	if !reflect.DeepEqual(got, want) {
		t.Errorf("price = %+v, want %+v", got, want)
	}
}

// currentOut is the current of a total as the API states it.
type currentOut struct {
	Count    int    `json:"count"`
	Open     bool   `json:"open"`
	OldestAt string `json:"oldest_at"`
}

type netWorthOut struct {
	Assets  map[string]any `json:"assets"`
	Current *currentOut    `json:"current"`
}

type netWorthDayOut struct {
	Date    string         `json:"date"`
	Assets  map[string]any `json:"assets"`
	Current *currentOut    `json:"current"`
}

type allocationCurrentOut struct {
	Current *currentOut `json:"current"`
}

func netWorthAt(t *testing.T, f fixture, date string) netWorthOut {
	t.Helper()

	var out netWorthOut
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/reports/net-worth?date="+date,
		nil,
		http.StatusOK,
		&out,
	)

	return out
}

func allocationAt(t *testing.T, f fixture, date string) allocationCurrentOut {
	t.Helper()

	var out allocationCurrentOut
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/reports/allocation?by=type&date="+date,
		nil,
		http.StatusOK,
		&out,
	)

	return out
}

// legOut is one price of a position as the API states it.
type legOut struct {
	Instrument string `json:"instrument"`
	Quote      string `json:"quote_instrument"`
	Value      string `json:"value"`
	Date       string `json:"date"`
	Source     string `json:"source"`
	At         string `json:"at"`
	Open       bool   `json:"open"`
}

// foreignBaseFixture is a book of region NZ and base USD that holds 100 MXRF11 bought with a
// manual USD/BRL price; the chart source answers the currency pair with answer.
func foreignBaseFixture(t *testing.T, answer func(w http.ResponseWriter)) fixture {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/yahoo/MXRF11.SA":
			_, _ = w.Write([]byte(currentBody("BRL", "America/Sao_Paulo", "9.25")))
		case "/yahoo/BRLUSD=X":
			answer(w)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	profile := apitest.Profile{
		Name:   "nz_usd",
		Locale: locale.Locale{Language: "en", Region: "NZ"},
		Base:   "USD",
	}
	f := newFixture(
		t,
		apitest.As(profile),
		apitest.Clock(func() time.Time { return time.Date(2026, 11, 3, 15, 13, 0, 0, time.UTC) }),
		apitest.PriceFeeds(
			[]string{"yahoo_chart"},
			map[string]string{"yahoo_chart": srv.URL + "/yahoo"},
		),
	)

	rate, err := money.ParseRate("5.50")
	if err != nil {
		t.Fatal(err)
	}

	manual := marketdata.Price{
		Instrument: "USD",
		Quote:      "BRL",
		Date:       time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		Value:      rate,
		Source:     "manual",
	}
	if err := f.h.App.Marketdata.RecordPrices(
		t.Context(),
		0,
		[]marketdata.Price{manual},
	); err != nil {
		t.Fatal(err)
	}

	// A trade requires a cash account in the base currency (USD).
	f.cash = f.h.Account(
		"XP cash USD",
		"asset",
		"brokerage",
		map[string]any{"institution_id": f.institution, "currency": "USD"},
	)

	f.trade(t, "buy", "2026-10-05", 100, "10.05", 0)
	f.h.Dispatch()
	recordMXRF11(t, f, "2026-10-30", "9.10", "b3_consolidated")

	return f
}

// CQ26: the assistant tool states that the values of today took current quotes.
func TestToolStatesCurrentQuotes(t *testing.T) {
	t.Parallel()

	f, _ := currentFixture(t, answerOK)

	type current struct {
		Count    int    `json:"count"`
		Open     bool   `json:"open"`
		OldestAt string `json:"oldest_at"`
	}

	want := current{Count: 1, Open: true, OldestAt: "2026-11-03T14:58:00Z"}

	for _, args := range []map[string]any{
		{"view": "positions"},
		{"view": "net_worth"},
		{"view": "allocation", "by": "currency"},
	} {
		var out struct {
			Current *current `json:"current"`
		}

		toolOutput(t, f.h, "get_portfolio", args, &out)

		if out.Current == nil || *out.Current != want {
			t.Fatalf("%v: current = %+v, want %+v", args["view"], out.Current, want)
		}
	}

	var earlier struct {
		Current *current `json:"current"`
	}

	toolOutput(
		t,
		f.h,
		"get_portfolio",
		map[string]any{"view": "net_worth", "date": "2026-11-02"},
		&earlier,
	)

	if earlier.Current != nil {
		t.Fatalf("net worth of an earlier date: current = %+v, want none", earlier.Current)
	}
}
