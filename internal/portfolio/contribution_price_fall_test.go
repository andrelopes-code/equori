package portfolio_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// No trade follows the fixture: a price alone moves the shares and the contribution of 2,000.00,
// among the groups and among the assets of a group (CN5, CN7, CN16).
func TestPriceFallMovesTheContribution(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		bova, petr string
		target     int // of the fixed income, in basis points

		shares        []int   // fixed income, stocks
		amounts       []int64 // fixed income, stocks
		memberShares  []int   // BOVA11, PETR4
		memberAmounts []int64 // BOVA11, PETR4
	}{
		{
			name: "no change", bova: "100.00", petr: "50.00", target: 5000,
			shares: []int{5000, 5000}, amounts: []int64{100000, 100000},
			memberShares: []int{5000, 5000}, memberAmounts: []int64{50000, 50000},
		},
		{
			name: "both fall 20%", bova: "80.00", petr: "40.00", target: 5000,
			shares: []int{5555, 4445}, amounts: []int64{0, 200000},
			memberShares: []int{5000, 5000}, memberAmounts: []int64{100000, 100000},
		},
		{
			name: "only the etf falls 20%", bova: "80.00", petr: "50.00", target: 5000,
			shares: []int{5263, 4737}, amounts: []int64{50000, 150000},
			memberShares: []int{4445, 5555}, memberAmounts: []int64{125000, 25000},
		},
		{
			name: "only the stock falls 20%", bova: "100.00", petr: "40.00", target: 5000,
			shares: []int{5263, 4737}, amounts: []int64{50000, 150000},
			memberShares: []int{5555, 4445}, memberAmounts: []int64{25000, 125000},
		},
		{
			name: "both rise 20%", bova: "120.00", petr: "60.00", target: 5000,
			shares: []int{4546, 5454}, amounts: []int64{200000, 0},
			memberShares: []int{5000, 5000}, memberAmounts: []int64{0, 0},
		},
		{
			name:          "both fall 20% and stay above the target",
			bova:          "80.00",
			petr:          "40.00",
			target:        9000,
			shares:        []int{5555, 4445},
			amounts:       []int64{200000, 0},
			memberShares:  []int{5000, 5000},
			memberAmounts: []int64{0, 0},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newPriceFallFixture(t)
			f.price("BOVA11", "2026-11-01", tt.bova)
			f.price("PETR4", "2026-11-01", tt.petr)

			got := f.preview(t, f.halves(tt.target))

			if !slices.Equal(got.shares(t), tt.shares) ||
				!slices.Equal(got.amounts(t), tt.amounts) {
				t.Fatalf("shares %v amounts %v", got.shares(t), got.amounts(t))
			}

			shares, amounts := memberSplit(t, got.Classes[1])
			if !slices.Equal(shares, tt.memberShares) ||
				!slices.Equal(amounts, tt.memberAmounts) {
				t.Fatalf("member shares %v amounts %v", shares, amounts)
			}
		})
	}
}

// Groups that fall by the same proportion keep their shares and the split (CN5, CN7).
func TestEqualPriceFallKeepsTheContribution(t *testing.T) {
	t.Parallel()

	f := newPriceFallFixture(t)
	f.price("BOVA11", "2026-11-01", "80.00")
	f.price("PETR4", "2026-11-01", "40.00")

	got := f.preview(t, map[string]any{
		"amount": apitest.BRL(200000),
		"classes": []any{
			contributionClass("ETFs", 5000, instrumentMember("BOVA11")),
			contributionClass("Stocks", 5000, instrumentMember("PETR4")),
		},
	})

	if !slices.Equal(got.values(), []int64{400000, 400000}) ||
		!slices.Equal(got.shares(t), []int{5000, 5000}) ||
		!slices.Equal(got.amounts(t), []int64{100000, 100000}) {
		t.Fatalf("values %v shares %v amounts %v", got.values(), got.shares(t), got.amounts(t))
	}
}

// A fall of the open session moves the contribution before the close exists (A248 CQ21).
func TestSessionPriceFallMovesTheContribution(t *testing.T) {
	t.Parallel()

	quotes := map[string]string{"/yahoo/BOVA11.SA": "80", "/yahoo/PETR4.SA": "40"}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		price, ok := quotes[r.URL.Path]
		if !ok {
			http.NotFound(w, r)

			return
		}

		_, _ = fmt.Fprint(w, currentBody("BRL", "America/Sao_Paulo", price))
	}))
	t.Cleanup(srv.Close)

	f := newPriceFallFixture(
		t,
		apitest.Clock(func() time.Time { return time.Date(2026, 11, 3, 15, 13, 0, 0, time.UTC) }),
		apitest.PriceFeeds(
			[]string{"yahoo_chart"},
			map[string]string{"yahoo_chart": srv.URL + "/yahoo"},
		),
	)

	got := f.preview(t, f.halves(5000))

	if !slices.Equal(got.shares(t), []int{5555, 4445}) ||
		!slices.Equal(got.amounts(t), []int64{0, 200000}) {
		t.Fatalf("shares %v amounts %v", got.shares(t), got.amounts(t))
	}

	want := &currentOut{Count: 2, Open: true, OldestAt: "2026-11-03T14:58:00Z"}
	if !reflect.DeepEqual(got.Current, want) {
		t.Errorf("current = %+v, want %+v", got.Current, want)
	}
}

type priceFallFixture struct {
	contributionFixture
}

// newPriceFallFixture holds a CDB of 10,000.00, 50 BOVA11 at 100.00 and 100 PETR4 at 50.00, both
// priced on 2026-10-30.
func newPriceFallFixture(t *testing.T, opts ...apitest.Option) priceFallFixture {
	t.Helper()

	f := newFixture(t, opts...)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("BOVA11", "etf"),
		http.StatusCreated,
		nil,
	)

	cdb := f.h.Account("CDB", "asset", "reserve", nil)
	f.h.Record("2026-10-01", apitest.Posting(cdb, 1000000), apitest.Posting(f.dividends, -1000000))
	f.h.Record(
		"2026-10-01",
		apitest.Posting(f.cash, 1000000),
		apitest.Posting(f.dividends, -1000000),
	)

	out := priceFallFixture{contributionFixture{fixture: f, cdb: cdb}}
	out.buy(f.holdingAccount("BOVA11"), "BOVA11", 50, "100.00")
	out.buy(f.petr4, "PETR4", 100, "50.00")
	f.h.Dispatch()

	return out
}

// halves splits the stocks in halves and gives the fixed income fixedTarget.
func (f priceFallFixture) halves(fixedTarget int) map[string]any {
	return map[string]any{
		"amount": apitest.BRL(200000),
		"classes": []any{
			contributionClass("Fixed income", fixedTarget, map[string]any{"account_id": f.cdb}),
			contributionClass(
				"Stocks",
				10000-fixedTarget,
				instrumentMember("BOVA11", 5000),
				instrumentMember("PETR4", 5000),
			),
		},
	}
}

func (f priceFallFixture) buy(account, code string, quantity int64, price string) {
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      account,
		"cash_account_id": f.cash,
		"side":            "buy",
		"date":            "2026-10-10",
		"quantity":        units(quantity, code),
		"unit_price":      price,
	}, http.StatusCreated, nil)
	f.price(code, "2026-10-30", price)
}

func (f priceFallFixture) price(code, date, value string) {
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       code,
		"quote_instrument": "BRL",
		"date":             date,
		"value":            value,
	}, http.StatusCreated, nil)
}

func memberSplit(t *testing.T, c classOut) (shares []int, amounts []int64) {
	t.Helper()

	for _, m := range c.Members {
		if m.ShareBP == nil || m.Amount == nil {
			t.Fatalf("member without share or amount: %+v", m)
		}

		shares = append(shares, *m.ShareBP)
		amounts = append(amounts, m.Amount.Amount)
	}

	return shares, amounts
}
