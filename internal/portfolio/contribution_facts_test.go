package portfolio_test

import (
	"context"
	"fmt"
	"net/http"
	"reflect"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const (
	listingA = "11111111000111"
	listingB = "22222222000122"
)

var factKeys = []string{
	"piotroski_p1", "piotroski_p2", "piotroski_p3", "piotroski_p4", "piotroski_p5",
	"piotroski_p6", "piotroski_p7", "piotroski_p8", "piotroski_p9",
}

type factMemberOut struct {
	Instrument  string   `json:"instrument"`
	TargetBP    *int     `json:"target_bp"`
	FactAnswers []string `json:"fact_answers"`
	FactsYear   *string  `json:"facts_year"`
}

type factClassOut struct {
	QuestionFacts  []string        `json:"question_facts"`
	QuestionIdeals bool            `json:"question_ideals"`
	Members        []factMemberOut `json:"members"`
}

type factPlanOut struct {
	Classes []factClassOut `json:"classes"`
}

// fiscalYear holds the accounts of one stored fiscal year; a nil account is stored as null.
type fiscalYear struct {
	end                                                  string
	totalAssets, currentAssets, currentLiabilities, debt any
	revenue, grossProfit, netIncome, cashFlow, shares    any
	// raised is the capital_raised of the report.
	raised any
}

// S675: a save with the nine facts for two stocks of three fiscal years returns the fact
// answers, the fiscal year they read and the ideals derived from them.
func TestS675SaveFactQuestions(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)
	seedFiscalYears(t, f.h, "QSTA3", listingA, factYearsA())
	seedFiscalYears(t, f.h, "QSTB3", listingB, factYearsB())
	enableCompanyReportFeed(t, f.h)

	var saved factPlanOut
	f.h.MustDo(
		http.MethodPut,
		contributionPath,
		nineFactsDraft(false, false),
		http.StatusOK,
		&saved,
	)
	expectS675(t, saved)

	var got factPlanOut
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &got)
	expectS675(t, got)
}

// S679: the tools save and read the plan of S675 with its fact answers.
func TestS679FactQuestionsTool(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)
	seedFiscalYears(t, f.h, "QSTA3", listingA, factYearsA())
	seedFiscalYears(t, f.h, "QSTB3", listingB, factYearsB())
	enableCompanyReportFeed(t, f.h)

	var saved factPlanOut
	toolOutput(t, f.h, "save_contribution_plan", nineFactsDraft(false, false), &saved)
	expectS675(t, saved)

	var read struct {
		Contribution factPlanOut `json:"contribution"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "contribution"}, &read)
	expectS675(t, read.Contribution)
}

// S676: a fiscal year stored after the save changes the fact answers and the ideals of GET.
func TestS676LaterFiscalYear(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)
	seedFiscalYears(t, f.h, "QSTA3", listingA, factYearsA())
	seedFiscalYears(t, f.h, "QSTB3", listingB, factYearsB())
	enableCompanyReportFeed(t, f.h)
	f.h.MustDo(http.MethodPut, contributionPath, nineFactsDraft(false, false), http.StatusOK, nil)

	later := factYearsA()[0]
	later.end, later.netIncome = "2026-12-31", int64(-1)
	seedFiscalYears(t, f.h, "QSTB3", listingB, []fiscalYear{later})

	var got factPlanOut
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &got)

	a, b := got.Classes[0].Members[0], got.Classes[0].Members[1]
	wantB := []string{"no", "yes", "no", "yes", "yes", "no", "yes", "yes", "no"}

	if !reflect.DeepEqual(a.FactAnswers, repeat("yes", 9)) || *a.FactsYear != "2025-12-31" {
		t.Fatalf("QSTA3 = %+v", a)
	}

	if !reflect.DeepEqual(b.FactAnswers, wantB) || b.FactsYear == nil ||
		*b.FactsYear != "2026-12-31" {
		t.Fatalf("QSTB3 = %+v", b)
	}

	if *a.TargetBP != 6429 || *b.TargetBP != 3571 {
		t.Fatalf("targets = %d, %d", *a.TargetBP, *b.TargetBP)
	}
}

// S677: a stock without filings keeps the investor's answers and carries no fiscal year.
func TestS677NoFilings(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)
	seedFiscalYears(t, f.h, "QSTA3", listingA, factYearsA())
	enableCompanyReportFeed(t, f.h)

	class := questionClass(
		[]string{"Sinal", "Tem tag along?"},
		answerMember("QSTA3", false, true),
		answerMember("QSTC3", true, false),
	)
	class["question_facts"] = []string{"piotroski_p1", ""}

	var got factPlanOut
	f.h.MustDo(
		http.MethodPut,
		contributionPath,
		map[string]any{"classes": []any{class}},
		http.StatusOK,
		&got,
	)

	a, c := got.Classes[0].Members[0], got.Classes[0].Members[1]

	if !reflect.DeepEqual(a.FactAnswers, []string{"yes", "none"}) || a.FactsYear == nil {
		t.Fatalf("QSTA3 = %+v", a)
	}

	if !reflect.DeepEqual(c.FactAnswers, []string{"none", "none"}) || c.FactsYear != nil {
		t.Fatalf("QSTC3 = %+v", c)
	}

	if *a.TargetBP != 6667 || *c.TargetBP != 3333 {
		t.Fatalf("targets = %d, %d", *a.TargetBP, *c.TargetBP)
	}
}

// S678: each invalid case of FQ10 returns contribution_question_invalid.
func TestS678InvalidFacts(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	tests := []struct {
		name  string
		facts []string
		class map[string]any
	}{
		{
			name:  "fact outside the catalog",
			facts: []string{"piotroski_p10"},
			class: questionClass([]string{"Q1"}, answerMember("QSTA3", true)),
		},
		{
			name:  "fact named twice",
			facts: []string{"piotroski_p1", "piotroski_p1"},
			class: questionClass([]string{"Q1", "Q2"}, answerMember("QSTA3", true, true)),
		},
		{
			name:  "one fact for two questions",
			facts: []string{"piotroski_p1"},
			class: questionClass([]string{"Q1", "Q2"}, answerMember("QSTA3", true, true)),
		},
		{
			name:  "fact in a group without questions",
			facts: []string{"piotroski_p1"},
			class: contributionClass("Questions", 10000, instrumentMember("QSTA3")),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.class["question_facts"] = tt.facts

			f.h.ExpectProblem(
				f.h.Do(
					http.MethodPut,
					contributionPath,
					map[string]any{"classes": []any{tt.class}},
				),
				http.StatusUnprocessableEntity,
				"contribution_question_invalid",
				"",
			)
		})
	}
}

// S680: a book of region US, with the company report feed disabled, saves the nine facts and
// derives the ideals from the stored answers.
func TestS680OutsideBrazil(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-01"))
	us := h.LoginAs("us@example.com", locale.Locale{Language: "en", Region: "US"}, "USD")

	for _, code := range []string{"QSTA3", "QSTB3"} {
		def := security(code, "stock")
		def["quote_currency"] = "USD"

		res := h.Call(us, http.MethodPost, "/api/v1/instruments", def)
		if res.Status != http.StatusCreated {
			t.Fatalf("create %s: %d %s", code, res.Status, res.Body)
		}
	}

	seedFiscalYears(t, h, "QSTA3", listingA, factYearsA())
	seedFiscalYears(t, h, "QSTB3", listingB, factYearsB())

	res := h.Call(us, http.MethodPut, contributionPath, nineFactsDraft(true, false))
	if res.Status != http.StatusOK {
		t.Fatalf("save: %d %s", res.Status, res.Body)
	}

	var got factPlanOut
	res.Decode(t, &got)

	for i, m := range got.Classes[0].Members {
		if !reflect.DeepEqual(m.FactAnswers, repeat("none", 9)) || m.FactsYear != nil {
			t.Fatalf("member %d = %+v", i, m)
		}
	}

	a, b := got.Classes[0].Members[0], got.Classes[0].Members[1]
	if *a.TargetBP != 10000 || *b.TargetBP != 0 {
		t.Fatalf("targets = %d, %d", *a.TargetBP, *b.TargetBP)
	}
}

func expectS675(t *testing.T, got factPlanOut) {
	t.Helper()

	c := got.Classes[0]
	if !reflect.DeepEqual(c.QuestionFacts, factKeys) || !c.QuestionIdeals || len(c.Members) != 2 {
		t.Fatalf("class = %+v", c)
	}

	a, b := c.Members[0], c.Members[1]
	wantB := repeat("yes", 9)
	wantB[6], wantB[7] = "no", "no"

	if !reflect.DeepEqual(a.FactAnswers, repeat("yes", 9)) ||
		!reflect.DeepEqual(b.FactAnswers, wantB) {
		t.Fatalf("fact answers = %v, %v", a.FactAnswers, b.FactAnswers)
	}

	if a.FactsYear == nil || *a.FactsYear != "2025-12-31" ||
		b.FactsYear == nil || *b.FactsYear != "2025-12-31" {
		t.Fatalf("facts years = %v, %v", a.FactsYear, b.FactsYear)
	}

	if *a.TargetBP != 5625 || *b.TargetBP != 4375 {
		t.Fatalf("targets = %d, %d", *a.TargetBP, *b.TargetBP)
	}
}

// nineFactsDraft is one group of QSTA3 and QSTB3 with the nine questions of the nine facts and
// the stored answers of QSTA3 and QSTB3.
func nineFactsDraft(a, b bool) map[string]any {
	questions := make([]string, 9)
	for i := range questions {
		questions[i] = fmt.Sprintf("Sinal %d", i+1)
	}

	class := questionClass(
		questions,
		answerMember("QSTA3", slices.Repeat([]bool{a}, 9)...),
		answerMember("QSTB3", slices.Repeat([]bool{b}, 9)...),
	)
	class["question_facts"] = factKeys

	return map[string]any{"classes": []any{class}}
}

func enableCompanyReportFeed(t *testing.T, h *apitest.Harness) {
	t.Helper()

	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/br_cvm_cia",
		map[string]bool{"enabled": true},
		http.StatusOK,
		nil,
	)
}

// seedFiscalYears stores the listing of code and one standard report of 12 months per year.
func seedFiscalYears(
	t *testing.T,
	h *apitest.Harness,
	code, identifier string,
	years []fiscalYear,
) {
	t.Helper()

	ctx := context.Background()

	_, err := h.Pool.Exec(
		ctx,
		`INSERT INTO marketdata_company_listing (source, exchange, code, identifier, name)
		VALUES ('br_cvm_cia', 'BVMF', $1, $2, $1) ON CONFLICT DO NOTHING`,
		code, identifier,
	)
	if err != nil {
		t.Fatalf("seed the listing of %s: %v", code, err)
	}

	for _, y := range years {
		_, err := h.Pool.Exec(
			ctx,
			`INSERT INTO marketdata_company_report (source, identifier, period, months, file,
				currency, name, consolidated, plan, total_assets, current_assets,
				current_liabilities, long_debt, revenue, gross_profit, net_income,
				operating_cash_flow, shares_issued, capital_raised)
			VALUES ('br_cvm_cia', $1, $2::date, 12, $13, 'BRL', $3, true,
				'standard', $4, $5, $6, $7, $8, $9, $10, $11, $12, $14)`,
			identifier, y.end, code, y.totalAssets, y.currentAssets, y.currentLiabilities,
			y.debt, y.revenue, y.grossProfit, y.netIncome, y.cashFlow, y.shares, "dfp_"+y.end[:4],
			y.raised,
		)
		if err != nil {
			t.Fatalf("seed the report %s of %s: %v", y.end, code, err)
		}
	}
}

// factYearsA is the years of FQ10: the nine signals hold.
func factYearsA() []fiscalYear {
	return []fiscalYear{
		{
			end: "2025-12-31", totalAssets: int64(120000), currentAssets: int64(45000),
			currentLiabilities: int64(20000), debt: int64(28000), revenue: int64(100000),
			grossProfit: int64(32000), netIncome: int64(7700), cashFlow: int64(9000),
			shares: int64(100),
		},
		{
			end: "2024-12-31", totalAssets: int64(110000), currentAssets: int64(40000),
			currentLiabilities: int64(20000), debt: int64(30000), revenue: int64(90000),
			grossProfit: int64(27000), netIncome: int64(5000), cashFlow: int64(6000),
			shares: int64(100),
		},
		{end: "2023-12-31", totalAssets: int64(100000)},
	}
}

// factYearsB is factYearsA with 110 shares, issued for new resources, and a gross profit of 30,000
// in the newest year.
func factYearsB() []fiscalYear {
	y := factYearsA()
	y[0].shares, y[0].raised, y[0].grossProfit = int64(110), true, int64(30000)

	return y
}

func repeat(s string, n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = s
	}

	return out
}
