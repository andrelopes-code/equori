package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func usd(amount int64) map[string]any { return map[string]any{"amount": amount, "currency": "USD"} }

func (f fixture) price(t *testing.T, date, value string) {
	t.Helper()
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "USD", "quote_instrument": "BRL", "date": date, "value": value}, http.StatusCreated, nil)
}

// P8 amendment A72.
func TestSchedulesInAnotherCurrency(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	h := f.h
	wise := h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	var created struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/schedules", map[string]any{
		"kind": "bill", "account_id": wise, "counterpart_id": f.rent, "description": "rent", "amount": usd(50000),
		"recurrence": monthly("2026-11-05", 5, ""),
	}, http.StatusCreated, &created)

	var occ struct {
		Items []struct {
			ID             string         `json:"id"`
			ExpectedOn     string         `json:"expected_on"`
			ExpectedAmount map[string]any `json:"expected_amount"`
			State          string         `json:"state"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/occurrences?from=2026-11-01&to=2026-11-30&schedule_id="+created.ID, nil, http.StatusOK, &occ)
	if len(occ.Items) != 1 || occ.Items[0].ExpectedAmount["currency"] != "USD" || occ.Items[0].ExpectedAmount["amount"] != float64(50000) {
		t.Fatalf("occurrences = %+v", occ.Items)
	}
	h.Record("2026-11-05",
		map[string]any{"account_id": wise, "amount": usd(-50000), "weight": apitest.BRL(-275000)},
		apitest.Posting(f.rent, 275000),
	)
	h.Dispatch()
	h.MustDo(http.MethodGet, "/api/v1/occurrences?from=2026-11-01&to=2026-11-30&schedule_id="+created.ID, nil, http.StatusOK, &occ)
	if occ.Items[0].State != "realized" {
		t.Fatalf("USD occurrence not realized: %+v", occ.Items)
	}

	var projection struct {
		Opening map[string]any `json:"opening"`
		Points  []struct {
			Amount map[string]any `json:"amount"`
		} `json:"points"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+wise+"/projection?to=2026-12-31", nil, http.StatusOK, &projection)
	if projection.Opening["currency"] != "USD" || len(projection.Points) != 1 || projection.Points[0].Amount["currency"] != "USD" || projection.Points[0].Amount["amount"] != float64(-50000) {
		t.Fatalf("projection = %+v", projection)
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/schedules", map[string]any{
		"kind": "transfer", "account_id": f.checking, "counterpart_id": wise, "description": "x", "amount": apitest.BRL(100),
		"recurrence": monthly("2026-11-05", 5, ""),
	}), http.StatusUnprocessableEntity, "currency_unsupported", "counterpart_id")

	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{"code": "MXRF11", "type": "reit", "scale": 0, "name": "MXRF11", "quote_currency": "BRL"}, http.StatusCreated, nil)
	xp := h.Account("XP", "asset", "brokerage", nil)
	shares := h.Account("XP MXRF11", "asset", "brokerage", map[string]any{"parent_id": xp, "currency": "MXRF11"})
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/schedules", map[string]any{
		"kind": "income", "account_id": shares, "counterpart_id": f.salary, "description": "x", "amount": apitest.BRL(100),
		"recurrence": monthly("2026-11-05", 5, ""),
	}), http.StatusUnprocessableEntity, "currency_unsupported", "account_id")
}

type committedOut struct {
	Installments map[string]any `json:"installments"`
	Occurrences  map[string]any `json:"occurrences"`
	Total        map[string]any `json:"total"`
	Prices       []struct {
		Value string `json:"value"`
		Date  string `json:"date"`
	} `json:"prices"`
}

func TestS66ForeignSubscriptionCommitted(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	h := f.h
	wise := h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	subscriptions := h.Account("Subscriptions", "expense", "", nil)
	h.MustDo(http.MethodPost, "/api/v1/schedules", map[string]any{
		"kind": "subscription", "account_id": wise, "counterpart_id": subscriptions, "description": "streaming", "amount": usd(999),
		"recurrence": monthly("2026-12-10", 10, ""),
	}, http.StatusCreated, nil)
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/commitments?month=2026-12", nil), http.StatusUnprocessableEntity, "price_missing", "")

	f.price(t, "2026-10-30", "5.5")
	var out committedOut
	h.MustDo(http.MethodGet, "/api/v1/commitments?month=2026-12", nil, http.StatusOK, &out)
	if out.Occurrences["amount"] != float64(5494) || out.Occurrences["currency"] != "BRL" || out.Total["amount"] != float64(5494) ||
		len(out.Prices) != 1 || out.Prices[0].Value != "5.5" || out.Prices[0].Date != "2026-10-30" {
		t.Fatalf("committed = %+v", out)
	}
}

func TestS67GoalInForeignCurrency(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	h := f.h
	wise := h.Account("Wise USD", "asset", "checking", map[string]any{"currency": "USD"})
	h.Record("2026-10-14",
		map[string]any{"account_id": wise, "amount": usd(100000), "weight": apitest.BRL(548300)},
		apitest.Posting(f.checking, -548300),
	)
	h.Record("2026-10-15", apitest.Posting(f.checking, 823300), apitest.Posting(f.salary, -823300))
	f.price(t, "2026-10-30", "5.5000")

	var g struct {
		Current    map[string]any `json:"current"`
		Remaining  map[string]any `json:"remaining"`
		ProgressBP int            `json:"progress_bp"`
		Prices     []struct {
			Value string `json:"value"`
		} `json:"prices"`
	}
	h.MustDo(http.MethodPost, "/api/v1/goals", map[string]any{
		"name": "Trip", "target": usd(200000), "due_on": "2027-06-30", "account_ids": []string{wise, f.checking},
	}, http.StatusCreated, &g)
	if g.Current["amount"] != float64(150000) || g.Current["currency"] != "USD" || g.Remaining["amount"] != float64(50000) || g.ProgressBP != 7500 || len(g.Prices) != 1 || g.Prices[0].Value != "5.5" {
		t.Fatalf("goal = %+v", g)
	}
}

// S121: a goal over a brokerage account sums the value of its cash and of each security it
// holds, at the stored prices (P8 amendment A72; amendment A120 lets a parent hold several
// instruments).
func TestS121GoalOverBrokerage(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	h := f.h
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{"code": "MXRF11", "type": "reit", "scale": 0, "name": "MXRF11", "quote_currency": "BRL"}, http.StatusCreated, nil)
	xp := h.Account("XP", "asset", "brokerage", nil)
	cash := h.Account("XP cash", "asset", "brokerage", map[string]any{"parent_id": xp})
	shares := h.Account("XP MXRF11", "asset", "brokerage", map[string]any{"parent_id": xp, "currency": "MXRF11"})
	h.Record("2026-10-14", apitest.Posting(f.checking, -50000), apitest.Posting(cash, 50000))
	h.Record("2026-10-15",
		map[string]any{"account_id": shares, "amount": map[string]any{"amount": 10, "currency": "MXRF11"}, "weight": apitest.BRL(10000)},
		apitest.Posting(f.checking, -10000),
	)
	post := func(name string, accounts ...string) apitest.Response {
		return h.Do(http.MethodPost, "/api/v1/goals", map[string]any{"name": name, "target": apitest.BRL(100000), "due_on": "2027-06-30", "account_ids": accounts})
	}
	h.ExpectProblem(post("Broker", xp), http.StatusUnprocessableEntity, "price_missing", "")
	h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{"instrument": "MXRF11", "quote_instrument": "BRL", "date": "2026-10-30", "value": "10.5"}, http.StatusCreated, nil)

	var g struct {
		Current    map[string]any `json:"current"`
		ProgressBP int            `json:"progress_bp"`
		Prices     []struct {
			Instrument string `json:"instrument"`
			Value      string `json:"value"`
		} `json:"prices"`
		Parts []struct {
			AccountID  string         `json:"account_id"`
			Instrument string         `json:"instrument"`
			Quantity   map[string]any `json:"quantity"`
			Value      map[string]any `json:"value"`
		} `json:"parts"`
	}
	post("Broker", xp).Decode(t, &g)
	// The cash and the shares of the brokerage, each with its quantity and its value in the goal currency.
	if len(g.Parts) != 2 ||
		g.Parts[0].AccountID != xp || g.Parts[0].Instrument != "BRL" || g.Parts[0].Quantity["amount"] != float64(50000) || g.Parts[0].Value["amount"] != float64(50000) ||
		g.Parts[1].AccountID != xp || g.Parts[1].Instrument != "MXRF11" || g.Parts[1].Quantity["amount"] != float64(10) || g.Parts[1].Quantity["currency"] != "MXRF11" ||
		g.Parts[1].Value["amount"] != float64(10500) || g.Parts[1].Value["currency"] != "BRL" {
		t.Fatalf("parts = %+v", g.Parts)
	}
	if g.Current["amount"] != float64(60500) || g.Current["currency"] != "BRL" || g.ProgressBP != 6050 || len(g.Prices) != 1 || g.Prices[0].Instrument != "MXRF11" || g.Prices[0].Value != "10.5" {
		t.Fatalf("goal over the brokerage = %+v", g)
	}
	var list struct {
		Items []struct {
			Name string `json:"name"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/goals", nil, http.StatusOK, &list)
	if len(list.Items) != 1 {
		t.Fatalf("goals = %+v", list.Items)
	}
	h.ExpectProblem(post("Both", xp, shares), http.StatusUnprocessableEntity, "validation_failed", "account_ids")
	h.MustDo(http.MethodPost, "/api/v1/goals", map[string]any{"name": "Shares only", "target": apitest.BRL(100000), "due_on": "2027-06-30", "account_ids": []string{shares}}, http.StatusCreated, &g)
	if g.Current["amount"] != float64(10500) {
		t.Errorf("goal over the securities = %+v", g)
	}
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/accounts/"+xp+"/projection?to=2026-12-31", nil), http.StatusUnprocessableEntity, "currency_unsupported", "id")
}
