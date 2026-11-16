package portfolio_test

import (
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
)

const contributionPath = "/api/v1/contribution-plan"

type moneyOut struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

type memberOut struct {
	AccountID  string    `json:"account_id"`
	Instrument string    `json:"instrument"`
	Value      moneyOut  `json:"value"`
	ShareBP    *int      `json:"share_bp"`
	UnitValue  *moneyOut `json:"unit_value"`
	Amount     *moneyOut `json:"amount"`
	Quantity   *moneyOut `json:"quantity"`
	Cost       *moneyOut `json:"cost"`
}

type classOut struct {
	Name     string      `json:"name"`
	TargetBP int         `json:"target_bp"`
	Value    moneyOut    `json:"value"`
	ShareBP  *int        `json:"share_bp"`
	Amount   *moneyOut   `json:"amount"`
	Cost     *moneyOut   `json:"cost"`
	Members  []memberOut `json:"members"`
}

type outsideOut struct {
	AccountID  string    `json:"account_id"`
	Instrument string    `json:"instrument"`
	Value      *moneyOut `json:"value"`
}

type missingOut struct {
	AccountID  string `json:"account_id"`
	Instrument string `json:"instrument"`
	Kind       string `json:"kind"`
}

type contributionOut struct {
	Amount       *moneyOut    `json:"amount"`
	Status       string       `json:"status"`
	Total        moneyOut     `json:"total"`
	TotalAfter   *moneyOut    `json:"total_after"`
	DriftBP      *int         `json:"drift_bp"`
	DriftAfterBP *int         `json:"drift_after_bp"`
	Leftover     *moneyOut    `json:"leftover"`
	Classes      []classOut   `json:"classes"`
	Outside      []outsideOut `json:"outside"`
	Missing      []missingOut `json:"missing"`
}

type contributionFixture struct {
	fixture
	cdb string
}

// contributionFixture holds a CDB (reserve account) of 10,000.00, BOVA11 3,000.00, IVVB11
// 1,000.00 and MXRF11 4,000.00, all priced on 2026-10-30 (CN14).
func newContributionFixture(t *testing.T) contributionFixture {
	t.Helper()
	f := newFixture(t)

	for _, code := range []string{"BOVA11", "IVVB11"} {
		f.h.MustDo(
			http.MethodPost,
			"/api/v1/instruments",
			security(code, "etf"),
			http.StatusCreated,
			nil,
		)
	}

	cdb := f.h.Account("CDB", "asset", "reserve", nil)
	f.h.Record("2026-10-01", apitest.Posting(cdb, 1000000), apitest.Posting(f.dividends, -1000000))
	f.h.Record("2026-10-01", apitest.Posting(f.cash, 800000), apitest.Posting(f.dividends, -800000))

	for _, h := range []struct {
		code     string
		quantity int64
		price    string
	}{{"BOVA11", 30, "100.00"}, {"IVVB11", 10, "100.00"}, {"MXRF11", 400, "10.00"}} {
		account := f.holdingAccount(h.code)
		f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
			"account_id":      account,
			"cash_account_id": f.cash,
			"side":            "buy",
			"date":            "2026-10-10",
			"quantity":        units(h.quantity, h.code),
			"unit_price":      h.price,
		}, http.StatusCreated, nil)
		f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
			"instrument":       h.code,
			"quote_instrument": "BRL",
			"date":             "2026-10-30",
			"value":            h.price,
		}, http.StatusCreated, nil)
	}

	f.h.Dispatch()

	return contributionFixture{fixture: f, cdb: cdb}
}

func (f fixture) holdingAccount(code string) string {
	if code == "MXRF11" {
		return f.mxrf11
	}

	return f.h.Account("XP "+code, "asset", "brokerage", map[string]any{
		"institution_id": f.institution,
		"parent_id":      f.xp,
		"currency":       code,
	})
}

func contributionClass(name string, targetBP int, members ...map[string]any) map[string]any {
	return map[string]any{"name": name, "target_bp": targetBP, "members": members}
}

func instrumentMember(code string, targetBP ...int) map[string]any {
	m := map[string]any{"instrument": code}
	if len(targetBP) > 0 {
		m["target_bp"] = targetBP[0]
	}

	return m
}

func (f contributionFixture) plan(amount int64) map[string]any {
	return map[string]any{
		"amount": apitest.BRL(amount),
		"classes": []any{
			contributionClass("Fixed income", 4000, map[string]any{"account_id": f.cdb}),
			contributionClass("Domestic stocks", 2000, instrumentMember("BOVA11")),
			contributionClass("Foreign stocks", 2000, instrumentMember("IVVB11")),
			contributionClass("Real estate funds", 2000, instrumentMember("MXRF11")),
		},
	}
}

func (f contributionFixture) save(t *testing.T, body map[string]any) contributionOut {
	t.Helper()
	var out contributionOut
	f.h.MustDo(http.MethodPut, contributionPath, body, http.StatusOK, &out)

	return out
}

func (f contributionFixture) get(t *testing.T) contributionOut {
	t.Helper()
	var out contributionOut
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &out)

	return out
}

func (f contributionFixture) preview(t *testing.T, body map[string]any) contributionOut {
	t.Helper()
	var out contributionOut
	f.h.MustDo(http.MethodPost, contributionPath+"/preview", body, http.StatusOK, &out)

	return out
}

func (o contributionOut) values() []int64 {
	var out []int64
	for _, c := range o.Classes {
		out = append(out, c.Value.Amount)
	}

	return out
}

func (o contributionOut) amounts(t *testing.T) []int64 {
	t.Helper()

	var out []int64
	for _, c := range o.Classes {
		if c.Amount == nil {
			t.Fatalf("class %q has no amount: %+v", c.Name, o)
		}

		out = append(out, c.Amount.Amount)
	}

	return out
}

func (o contributionOut) shares(t *testing.T) []int {
	t.Helper()

	var out []int
	for _, c := range o.Classes {
		if c.ShareBP == nil {
			t.Fatalf("class %q has no share: %+v", c.Name, o)
		}

		out = append(out, *c.ShareBP)
	}

	return out
}

// S398: a saved plan returns the value, the share and the drift of each class.
func TestS398SavedPlanReturnsValues(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)
	f.save(t, f.plan(150000))

	got := f.get(t)
	if got.Status != "complete" || len(got.Outside) != 0 || len(got.Classes) != 4 ||
		got.Classes[0].Name != "Fixed income" || got.Classes[3].Name != "Real estate funds" {
		t.Fatalf("plan = %+v", got)
	}

	if !slices.Equal(got.values(), []int64{1000000, 300000, 100000, 400000}) ||
		!slices.Equal(got.shares(t), []int{5555, 1666, 557, 2222}) {
		t.Fatalf("values %v shares %v", got.values(), got.shares(t))
	}

	if got.DriftBP == nil || *got.DriftBP != 1777 || got.Amount == nil ||
		got.Amount.Amount != 150000 || got.Amount.Currency != "BRL" ||
		got.Total.Amount != 1800000 || got.TotalAfter != nil {
		t.Fatalf("drift, amount or total = %+v", got)
	}

	member := got.Classes[0].Members[0]
	if member.AccountID != f.cdb || member.Value.Amount != 1000000 || member.ShareBP == nil ||
		*member.ShareBP != 10000 {
		t.Fatalf("member = %+v", member)
	}
}

// S399: a contribution of 1,500.00 goes all to the foreign stocks (CN14).
func TestS399SplitOf1500(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)

	got := f.preview(t, f.plan(150000))
	if !slices.Equal(got.amounts(t), []int64{0, 0, 150000, 0}) {
		t.Fatalf("amounts = %v", got.amounts(t))
	}
}

// S400: a contribution of 4,000.00 raises the foreign and domestic stocks (CN14, CN15).
func TestS400SplitOf4000(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)

	got := f.preview(t, f.plan(400000))
	if !slices.Equal(got.amounts(t), []int64{0, 100000, 300000, 0}) {
		t.Fatalf("amounts = %v", got.amounts(t))
	}

	if got.TotalAfter == nil || got.TotalAfter.Amount != 2200000 || got.DriftBP == nil ||
		*got.DriftBP != 1777 || got.DriftAfterBP == nil || *got.DriftAfterBP != 545 {
		t.Fatalf("total after or drift = %+v", got)
	}

	if stored := f.get(t); len(stored.Classes) != 0 {
		t.Fatalf("preview stored a plan: %+v", stored)
	}
}

// S401: a class with member targets splits its amount to bring each member to its target (CN16).
func TestS401MemberSplit(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       "PETR4",
		"quote_instrument": "BRL",
		"date":             "2026-10-30",
		"value":            "40.00",
	}, http.StatusCreated, nil)

	body := f.plan(400000)
	body["classes"].([]any)[1] = contributionClass(
		"Domestic stocks",
		2000,
		instrumentMember("BOVA11", 5000),
		instrumentMember("PETR4", 5000),
	)

	got := f.preview(t, body)
	if !slices.Equal(got.amounts(t), []int64{0, 100000, 300000, 0}) {
		t.Fatalf("class amounts = %v", got.amounts(t))
	}

	bova, petr := got.Classes[1].Members[0], got.Classes[1].Members[1]
	if bova.Instrument != "BOVA11" || bova.Amount == nil || bova.Amount.Amount != 0 ||
		petr.Instrument != "PETR4" || petr.Amount == nil || petr.Amount.Amount != 100000 {
		t.Fatalf("members = %+v %+v", bova, petr)
	}

	if petr.UnitValue == nil || petr.UnitValue.Amount != 4000 || petr.UnitValue.Currency != "BRL" {
		t.Fatalf("PETR4 unit value = %+v", petr.UnitValue)
	}
}

// S408: the S401 preview turns the split into orders: PETR4 at 40.00 takes 25 units for 1,000.00
// and nothing is left over (CN17, CN18).
func TestS408OrdersOfTheMemberSplit(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       "PETR4",
		"quote_instrument": "BRL",
		"date":             "2026-10-30",
		"value":            "40.00",
	}, http.StatusCreated, nil)

	body := f.plan(400000)
	body["classes"].([]any)[1] = contributionClass(
		"Domestic stocks",
		2000,
		instrumentMember("BOVA11", 5000),
		instrumentMember("PETR4", 5000),
	)

	got := f.preview(t, body)
	petr := got.Classes[1].Members[1]

	if petr.Quantity == nil || *petr.Quantity != (moneyOut{Amount: 25, Currency: "PETR4"}) {
		t.Fatalf("PETR4 quantity = %+v", petr.Quantity)
	}

	if petr.Cost == nil || *petr.Cost != (moneyOut{Amount: 100000, Currency: "BRL"}) {
		t.Fatalf("PETR4 cost = %+v", petr.Cost)
	}

	if got.Leftover == nil || got.Leftover.Amount != 0 {
		t.Fatalf("leftover = %+v", got.Leftover)
	}

	if cdb := got.Classes[0]; cdb.Cost == nil || cdb.Cost.Amount != 0 {
		t.Fatalf("Fixed income cost = %+v", cdb.Cost)
	}
}

// S409: a step that does not fit the leftover leaves it in the view (CN18). IVVB11 holds 10 units
// at 100.00 (1,000.00) and PETR4 is priced at 30.01, so the split of 1,000.00 over two classes of
// 50% each gives 1,000.00 to PETR4 and 0 to IVVB11. PETR4: q = floor(100000 / 3001) = 33 units,
// cost 33 × 3001 = 99033, leftover 100000 - 99033 = 967. One more PETR4 unit costs 3001 and one
// IVVB11 unit costs 10000, both above 967, and no entry is cash-like, so 967 stays.
func TestS409LeftoverThatNoStepFits(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       "PETR4",
		"quote_instrument": "BRL",
		"date":             "2026-10-30",
		"value":            "30.01",
	}, http.StatusCreated, nil)

	got := f.preview(t, map[string]any{
		"amount": apitest.BRL(100000),
		"classes": []any{
			contributionClass("Domestic stocks", 5000, instrumentMember("PETR4", 10000)),
			contributionClass("Foreign stocks", 5000, instrumentMember("IVVB11", 10000)),
		},
	})
	petr, ivvb := got.Classes[0].Members[0], got.Classes[1].Members[0]

	if petr.Quantity == nil || petr.Quantity.Amount != 33 || petr.Cost == nil ||
		petr.Cost.Amount != 99033 {
		t.Fatalf("PETR4 order = %+v %+v", petr.Quantity, petr.Cost)
	}

	if ivvb.Quantity == nil || ivvb.Quantity.Amount != 0 || ivvb.Cost == nil ||
		ivvb.Cost.Amount != 0 {
		t.Fatalf("IVVB11 order = %+v %+v", ivvb.Quantity, ivvb.Cost)
	}

	if got.Leftover == nil || got.Leftover.Amount != 967 {
		t.Fatalf("leftover = %+v", got.Leftover)
	}
}

// A member of a group with an ideal of 1 bp keeps a positive weight in the leftover (CN18). PETR4
// is priced at 30.50 and takes the whole split of 1,000.00: q = floor(100000 / 3050) = 32 units,
// cost 32 × 3050 = 97600, leftover 100000 - 97600 = 2400. One more PETR4 unit costs 3050 and one
// more BOVA11 unit costs 10000, both above 2400. One MXRF11 unit costs 1000, and its ideal is
// 1 bp × 5000 bp, positive although 1 × 5000 / 10000 truncates to 0. MXRF11 takes two steps,
// 2400 - 2 × 1000 = 400, and a third step costs 1000.
func TestLeftoverReachesMemberOfSmallGroup(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       "PETR4",
		"quote_instrument": "BRL",
		"date":             "2026-10-30",
		"value":            "30.50",
	}, http.StatusCreated, nil)

	got := f.preview(t, map[string]any{
		"amount": apitest.BRL(100000),
		"classes": []any{
			contributionClass(
				"Domestic stocks",
				1,
				instrumentMember("BOVA11", 5000),
				instrumentMember("MXRF11", 5000),
			),
			contributionClass("Foreign stocks", 9999, instrumentMember("PETR4", 10000)),
		},
	})
	mxrf := got.Classes[0].Members[1]

	if mxrf.Quantity == nil || mxrf.Quantity.Amount != 2 || mxrf.Cost == nil ||
		mxrf.Cost.Amount != 2000 {
		t.Fatalf("MXRF11 order = %+v %+v", mxrf.Quantity, mxrf.Cost)
	}

	if got.Leftover == nil || got.Leftover.Amount != 400 {
		t.Fatalf("leftover = %+v", got.Leftover)
	}
}

// S402: a holding without a price makes the plan incomplete: no share, drift or amount (CN10).
func TestS402MissingPrice(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)

	for _, code := range []string{"KNRI11", "HGLG11"} {
		f.h.MustDo(
			http.MethodPost,
			"/api/v1/instruments",
			security(code, "reit"),
			http.StatusCreated,
			nil,
		)
		f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
			"account_id":      f.holdingAccount(code),
			"cash_account_id": f.cash,
			"side":            "buy",
			"date":            "2026-10-10",
			"quantity":        units(5, code),
			"unit_price":      "100.00",
		}, http.StatusCreated, nil)
	}

	f.h.Dispatch()

	body := f.plan(400000)
	body["classes"] = []any{
		contributionClass("Fixed income", 5000, map[string]any{"account_id": f.cdb}),
		contributionClass(
			"Real estate funds",
			5000,
			instrumentMember("MXRF11"),
			instrumentMember("KNRI11"),
		),
	}

	got := f.preview(t, body)
	if got.Status != "incomplete" || len(got.Missing) != 1 ||
		got.Missing[0] != (missingOut{Instrument: "KNRI11", Kind: "price"}) {
		t.Fatalf("status or missing = %+v", got)
	}

	if got.DriftBP != nil || got.DriftAfterBP != nil || got.TotalAfter != nil {
		t.Fatalf("drift or total after = %+v", got)
	}

	for _, c := range got.Classes {
		if c.Amount != nil || c.ShareBP != nil {
			t.Fatalf("class %q has an amount or a share: %+v", c.Name, c)
		}

		for _, m := range c.Members {
			if m.Amount != nil || m.ShareBP != nil {
				t.Fatalf("member %q has an amount or a share: %+v", m.Instrument, m)
			}
		}
	}

	if got.Classes[0].Members[0].Value.Amount != 1000000 ||
		got.Classes[1].Members[0].Value.Amount != 400000 {
		t.Fatalf("priced members lost their value: %+v", got.Classes)
	}

	if !slices.ContainsFunc(got.Outside, func(o outsideOut) bool {
		return o.Instrument == "HGLG11" && o.Value == nil
	}) {
		t.Fatalf("outside = %+v", got.Outside)
	}
}

// S403: class targets that do not add up to 10000 are rejected.
func TestS403TargetSum(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)

	body := f.plan(150000)
	body["classes"] = []any{
		contributionClass("Fixed income", 4000, map[string]any{"account_id": f.cdb}),
		contributionClass("Equities", 5900, instrumentMember("BOVA11")),
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPut, contributionPath, body),
		http.StatusUnprocessableEntity,
		"contribution_target_sum",
		"",
	)
}

// S406: a member held in another currency than the base is valued at the rate of today (CN9).
func TestS406ForeignBase(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.As(apitest.ForeignBase()))
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       "BRL",
		"quote_instrument": "USD",
		"date":             "2026-10-30",
		"value":            "0.20",
	}, http.StatusCreated, nil)

	cdb := f.h.Account("CDB", "asset", "reserve", map[string]any{"currency": "BRL"})
	source := f.h.Account("Salary", "income", "", map[string]any{"currency": "BRL"})
	f.h.Record(
		"2026-10-01",
		map[string]any{
			"account_id": cdb,
			"amount":     apitest.BRL(500000),
			"weight":     f.h.Money(100000),
		},
		map[string]any{
			"account_id": source,
			"amount":     apitest.BRL(-500000),
			"weight":     f.h.Money(-100000),
		},
	)
	f.h.Dispatch()

	f.h.MustDo(http.MethodPut, contributionPath, map[string]any{
		"classes": []any{
			contributionClass("Fixed income", 10000, map[string]any{"account_id": cdb}),
		},
	}, http.StatusOK, nil)

	var got contributionOut
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &got)

	member := got.Classes[0].Members[0]
	if got.Status != "complete" || member.Value != (moneyOut{Amount: 100000, Currency: "USD"}) ||
		got.Total != (moneyOut{Amount: 100000, Currency: "USD"}) {
		t.Fatalf("plan = %+v", got)
	}
}

// S407: the preview reports the drift before and after the contribution (CN15).
func TestS407DriftBeforeAfter(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)

	got := f.preview(t, f.plan(400000))
	if got.DriftBP == nil || *got.DriftBP != 1777 || got.DriftAfterBP == nil ||
		*got.DriftAfterBP != 545 {
		t.Fatalf("drift = %+v", got)
	}
}

// S404: an instrument in two classes is rejected.
func TestS404MemberDuplicate(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)

	body := f.plan(150000)
	body["classes"] = []any{
		contributionClass("Real estate funds", 5000, instrumentMember("MXRF11")),
		contributionClass("Income", 5000, instrumentMember("MXRF11")),
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPut, contributionPath, body),
		http.StatusUnprocessableEntity,
		"contribution_member_duplicate",
		"",
	)
}

func TestContributionProblems(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)
	checking := f.h.Account("Checking", "asset", "checking", nil)

	tests := []struct {
		name    string
		method  string
		path    string
		classes []any
		amount  map[string]any
		status  int
		code    string
	}{
		{
			name:   "member target sum",
			method: http.MethodPut,
			path:   contributionPath,
			classes: []any{
				contributionClass(
					"Equities",
					10000,
					instrumentMember("BOVA11", 5000),
					instrumentMember("IVVB11", 4000),
				),
			},
			status: http.StatusUnprocessableEntity,
			code:   "contribution_member_target_sum",
		},
		{
			name:   "class name duplicate",
			method: http.MethodPut,
			path:   contributionPath,
			classes: []any{
				contributionClass("FII", 5000, instrumentMember("MXRF11")),
				contributionClass("fii", 5000, instrumentMember("BOVA11")),
			},
			status: http.StatusUnprocessableEntity,
			code:   "contribution_class_name_duplicate",
		},
		{
			name:   "member invalid account",
			method: http.MethodPut,
			path:   contributionPath,
			classes: []any{
				contributionClass("Cash", 10000, map[string]any{"account_id": checking}),
			},
			status: http.StatusUnprocessableEntity,
			code:   "contribution_member_invalid",
		},
		{
			name:    "member invalid instrument",
			method:  http.MethodPut,
			path:    contributionPath,
			classes: []any{contributionClass("Other", 10000, instrumentMember("ZZZZ99"))},
			status:  http.StatusUnprocessableEntity,
			code:    "contribution_member_invalid",
		},
		{
			name:    "amount invalid",
			method:  http.MethodPost,
			path:    contributionPath + "/preview",
			classes: []any{contributionClass("Other", 10000, instrumentMember("BOVA11"))},
			amount:  apitest.BRL(0),
			status:  http.StatusUnprocessableEntity,
			code:    "contribution_amount_invalid",
		},
		{
			name:    "amount in another currency",
			method:  http.MethodPost,
			path:    contributionPath + "/preview",
			classes: []any{contributionClass("Other", 10000, instrumentMember("BOVA11"))},
			amount:  map[string]any{"amount": 100, "currency": "USD"},
			status:  http.StatusUnprocessableEntity,
			code:    "contribution_amount_invalid",
		},
		{
			name:    "empty class name",
			method:  http.MethodPut,
			path:    contributionPath,
			classes: []any{contributionClass("", 10000, instrumentMember("BOVA11"))},
			status:  http.StatusBadRequest,
			code:    "invalid_request",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := map[string]any{"classes": tt.classes}
			if tt.amount != nil {
				body["amount"] = tt.amount
			}

			f.h.ExpectProblem(f.h.Do(tt.method, tt.path, body), tt.status, tt.code, "")
		})
	}
}

// S478 (A236 FC1): a plan member never names a contract of another book.
func TestS478ContributionMemberOfAnotherBook(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)
	f.h.Login("other@example.com")

	_, err := f.h.App.Marketdata.DefineOwnInstrument(
		t.Context(),
		f.h.BooksIDOf("other@example.com"),
		marketdata.Instrument{
			Code:          "RF.280302.CS3YS",
			Type:          "fixed_income",
			Name:          "CDB Banco X",
			QuoteCurrency: "BRL",
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	body := map[string]any{
		"classes": []any{
			contributionClass("Fixed income", 10000, instrumentMember("RF.280302.CS3YS")),
		},
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPut, contributionPath, body),
		http.StatusUnprocessableEntity,
		"contribution_member_invalid",
		"",
	)
}

// S405: read members read and preview the plan; write members save it.
func TestS405RolesOnContributionPlan(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)
	body := map[string]any{
		"amount":  apitest.BRL(1000),
		"classes": []any{contributionClass("All", 10000, instrumentMember("BOVA11"))},
	}

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	if r := f.h.Call(reader, http.MethodGet, contributionPath, nil); r.Status != http.StatusOK {
		t.Fatalf("reader GET = %d: %s", r.Status, r.Body)
	}

	if r := f.h.Call(
		reader,
		http.MethodPost,
		contributionPath+"/preview",
		body,
	); r.Status != http.StatusOK {
		t.Fatalf("reader preview = %d: %s", r.Status, r.Body)
	}

	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodPut, contributionPath, body),
		http.StatusForbidden,
		"book_role_required",
		"",
	)

	writer := f.h.JoinAs("writer@example.com", f.h.OwnerID(), "write")
	if r := f.h.Call(writer, http.MethodPut, contributionPath, body); r.Status != http.StatusOK {
		t.Fatalf("writer PUT = %d: %s", r.Status, r.Body)
	}

	f.h.ExpectProblem(
		f.h.Call(&http.Client{}, http.MethodGet, contributionPath, nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)
}

func TestContributionPlanEmpty(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)

	got := f.get(t)
	if got.Status != "complete" || got.Classes == nil || len(got.Classes) != 0 ||
		got.DriftBP != nil || got.Amount != nil {
		t.Fatalf("empty plan = %+v", got)
	}

	outside := map[string]int64{}
	for _, o := range got.Outside {
		outside[o.AccountID+o.Instrument] = o.Value.Amount
	}

	want := map[string]int64{
		f.cdb + "": 1000000,
		"BOVA11":   300000,
		"IVVB11":   100000,
		"MXRF11":   400000,
	}
	if fmt.Sprint(outside) != fmt.Sprint(want) {
		t.Fatalf("outside = %v, want %v", outside, want)
	}
}
