package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// brokerage is an institution account of kind brokerage with a cash sub-account and a unit
// account in a non-base instrument, as a broker with its cash and one fund.
type brokerage struct {
	parent, cash, spare, fund string
	// checking is a checking account of the same institution: a trade takes its cash from the
	// brokerage or from an account of its institution.
	checking string
}

func (f fixture) brokerage() brokerage {
	f.h.T().Helper()

	var inst struct {
		ID string `json:"id"`
	}
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/institutions",
		map[string]string{"name": "Broker"},
		http.StatusCreated,
		&inst,
	)
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code":           "WRLD11",
		"type":           "stock",
		"scale":          0,
		"name":           "WRLD11",
		"quote_currency": "BRL",
		"exchange":       "BVMF",
	}, http.StatusCreated, nil)

	var b brokerage

	b.parent = f.h.Account("Broker", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
	})
	b.cash = f.h.Account("Caixa", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"parent_id":      b.parent,
	})
	b.spare = f.h.Account("Spare cash", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"parent_id":      b.parent,
	})
	b.fund = f.h.Account("WRLD11", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"parent_id":      b.parent,
		"currency":       "WRLD11",
	})

	b.checking = f.h.Account("Broker checking", "asset", "checking", map[string]any{
		"institution_id": inst.ID,
	})

	return b
}

// buy records a purchase of quantity units of the fund at price, paid from cash.
func (f fixture) buy(date string, b brokerage, cash string, quantity int64, price string) {
	f.h.T().Helper()
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      b.fund,
		"cash_account_id": cash,
		"side":            "buy",
		"date":            date,
		"quantity":        map[string]any{"amount": quantity, "currency": "WRLD11"},
		"unit_price":      price,
	}, http.StatusCreated, nil)
	f.h.Dispatch()
}

// S535 and S536: the set of savings accounts holds every brokerage account at any depth below
// an institution account, in any instrument. A deposit into the cash sub-account counts, a
// withdrawal counts against its month, a move between two sub-accounts counts nothing, and a
// purchase of units counts its cost only when an account outside the set pays it (A238).
func TestS535S536BrokerageAccountsInTheSavingsBucket(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-12")
	b := f.brokerage()
	f.h.Record("2026-06-10", apitest.Posting(b.cash, 100000), apitest.Posting(f.checking, -100000))
	f.h.Record("2026-07-10", apitest.Posting(f.checking, 30000), apitest.Posting(b.cash, -30000))
	f.h.Record("2026-08-10", apitest.Posting(b.spare, 20000), apitest.Posting(b.cash, -20000))
	f.buy("2026-09-10", b, b.cash, 10, "50")
	f.buy("2026-10-10", b, b.checking, 4, "50")
	f.saveBuckets(bucket("Needs", 5000, false, f.rent), bucket("Freedom", 5000, true))

	got := f.history("2026-11")

	// Months run from 2026-06 to 2026-11.
	want := []int64{100000, -30000, 0, 0, 20000, 0}
	for i, w := range want {
		if freedom := got.Months[i].Buckets[1].Real.Amount; freedom != w {
			t.Errorf("%s freedom = %d, want %d", got.Months[i].Month, freedom, w)
		}
	}
}
