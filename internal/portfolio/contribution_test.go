package portfolio_test

import (
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
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
	Amount     *moneyOut `json:"amount"`
}

type classOut struct {
	Name     string      `json:"name"`
	TargetBP int         `json:"target_bp"`
	Value    moneyOut    `json:"value"`
	ShareBP  *int        `json:"share_bp"`
	Amount   *moneyOut   `json:"amount"`
	Members  []memberOut `json:"members"`
}

type outsideOut struct {
	AccountID  string   `json:"account_id"`
	Instrument string   `json:"instrument"`
	Value      moneyOut `json:"value"`
}

type contributionOut struct {
	Amount       *moneyOut    `json:"amount"`
	Status       string       `json:"status"`
	Total        moneyOut     `json:"total"`
	TotalAfter   *moneyOut    `json:"total_after"`
	DriftBP      *int         `json:"drift_bp"`
	DriftAfterBP *int         `json:"drift_after_bp"`
	Classes      []classOut   `json:"classes"`
	Outside      []outsideOut `json:"outside"`
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
