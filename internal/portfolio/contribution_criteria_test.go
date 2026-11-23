package portfolio_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const (
	listingX = "55555555000155"

	questionInvalid = "contribution_question_invalid"
)

type criterionDetail struct {
	Value  string `json:"value"`
	Reason string `json:"reason"`
	Date   string `json:"date"`
}

type criterionMember struct {
	Instrument  string            `json:"instrument"`
	TargetBP    *int              `json:"target_bp"`
	Answers     []bool            `json:"answers"`
	FactAnswers []string          `json:"fact_answers"`
	FactDetails []criterionDetail `json:"fact_details"`
	FactsYear   *string           `json:"facts_year"`
}

type criterionPlan struct {
	Classes []struct {
		QuestionFacts  []string          `json:"question_facts"`
		QuestionLimits []string          `json:"question_limits"`
		Members        []criterionMember `json:"members"`
	} `json:"classes"`
}

// S689: a save with two limits returns the answers, what they read and the ideals derived.
func TestS689SaveCriteria(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)
	f.h.SeedCompany(t, "QSTA3", listingX)

	var saved criterionPlan
	f.h.MustDo(http.MethodPut, contributionPath, criteriaDraft(), http.StatusOK, &saved)
	expectS689(t, saved)

	var got criterionPlan
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &got)
	expectS689(t, got)
}

// S690: a filing that lowers the profit changes the answer of GET without a save; the stored
// answer is not read while the filings answer.
func TestS690LaterFiling(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)
	f.h.SeedCompany(t, "QSTA3", listingX)
	f.h.MustDo(http.MethodPut, contributionPath, criteriaDraft(), http.StatusOK, nil)

	// Twelve months: 10,000k + 8,999k - 7,500k = 11,499k over 1,150,000.00.
	execSQL(
		t,
		f.h,
		`UPDATE marketdata_company_report SET net_income = 8999000, net_income_parent = 8999000
		WHERE period = '2026-09-30'`,
	)

	var got criterionPlan
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &got)

	a := got.Classes[0].Members[0]
	if !reflect.DeepEqual(a.FactAnswers, []string{"no", "yes", "none"}) ||
		a.FactDetails[0].Value != "10.00087" {
		t.Fatalf("QSTA3 = %+v", a)
	}

	if *a.TargetBP != 5000 {
		t.Fatalf("target = %d, want 5000", *a.TargetBP)
	}
}

// S691: each invalid limit of AC17 returns contribution_question_invalid.
func TestS691InvalidLimits(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	for name, tc := range map[string]struct{ facts, limits []string }{
		"no limit":          {[]string{"price_earnings_max"}, nil},
		"blank":             {[]string{"price_earnings_max"}, []string{""}},
		"zero":              {[]string{"price_earnings_max"}, []string{"0"}},
		"above the range":   {[]string{"price_earnings_max"}, []string{"1000.0001"}},
		"half a year":       {[]string{"positive_years_min"}, []string{"2.5"}},
		"limit on a signal": {[]string{"piotroski_p1"}, []string{"1"}},
		"limit on an own":   {[]string{""}, []string{"1"}},
		"two for one":       {[]string{"roe_min"}, []string{"0.1", "0.2"}},
		"one key twice":     {[]string{"roe_min", "roe_min"}, []string{"0.1", "0.2"}},
	} {
		t.Run(name, func(t *testing.T) {
			questions := []string{"Q1", "Q2"}[:len(tc.facts)]
			class := questionClass(
				questions,
				answerMember("QSTA3", make([]bool, len(questions))...),
			)
			class["question_facts"] = tc.facts

			if tc.limits != nil {
				class["question_limits"] = tc.limits
			}

			f.h.ExpectProblem(
				f.h.Do(
					http.MethodPut,
					contributionPath,
					map[string]any{"classes": []any{class}},
				),
				http.StatusUnprocessableEntity,
				questionInvalid,
				"",
			)
		})
	}

	exponent := questionClass([]string{"Q1"}, answerMember("QSTA3", false))
	exponent["question_facts"] = []string{"price_earnings_max"}
	exponent["question_limits"] = []string{"1e3"}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPut, contributionPath, map[string]any{"classes": []any{exponent}}),
		http.StatusBadRequest,
		"invalid_request",
		"classes[0].question_limits[0]",
	)

	limits := contributionClass("Questions", 10000, instrumentMember("QSTA3"))
	limits["question_limits"] = []string{"1"}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPut, contributionPath, map[string]any{"classes": []any{limits}}),
		http.StatusUnprocessableEntity,
		questionInvalid,
		"",
	)
}

// S692: a count of shares a second filing does not confirm gives no multiple, and the investor's
// answer counts.
func TestS692UnverifiedShares(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)
	f.h.SeedCompany(t, "QSTA3", listingX)
	execSQL(t, f.h, `UPDATE marketdata_company_share_count SET shares = 1200000`)

	var got criterionPlan
	f.h.MustDo(http.MethodPut, contributionPath, criteriaDraft(), http.StatusOK, &got)

	a := got.Classes[0].Members[0]
	if !reflect.DeepEqual(a.FactAnswers, []string{"none", "yes", "none"}) ||
		a.FactDetails[0] != (criterionDetail{Reason: "shares"}) {
		t.Fatalf("QSTA3 = %+v", a)
	}

	// The stored answers of QSTA3 are no, no, no: one yes from the return on equity, against one
	// of QSTB3.
	if *a.TargetBP != 5000 {
		t.Fatalf("target = %d, want 5000", *a.TargetBP)
	}
}

// S694: the tools save and read the plan of S689.
func TestS694CriteriaTool(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)
	f.h.SeedCompany(t, "QSTA3", listingX)

	var saved criterionPlan
	toolOutput(t, f.h, "save_contribution_plan", criteriaDraft(), &saved)
	expectS689(t, saved)

	var read struct {
		Contribution criterionPlan `json:"contribution"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "contribution"}, &read)
	expectS689(t, read.Contribution)
}

// S695: a book of region US, with the source disabled, derives the ideals from the stored answers.
func TestS695CriteriaOutsideBrazil(t *testing.T) {
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

	res := h.Call(us, http.MethodPut, contributionPath, criteriaDraft())
	if res.Status != http.StatusOK {
		t.Fatalf("save: %d %s", res.Status, res.Body)
	}

	var got criterionPlan
	res.Decode(t, &got)

	for i, m := range got.Classes[0].Members {
		want := []criterionDetail{{Reason: "no_report"}, {Reason: "no_report"}, {}}
		if !reflect.DeepEqual(m.FactAnswers, repeat("none", 3)) ||
			!reflect.DeepEqual(m.FactDetails, want) {
			t.Fatalf("member %d = %+v", i, m)
		}
	}

	a, b := got.Classes[0].Members[0], got.Classes[0].Members[1]
	if *a.TargetBP != 0 || *b.TargetBP != 10000 {
		t.Fatalf("targets = %d, %d", *a.TargetBP, *b.TargetBP)
	}
}

// S696: the base currency of the book does not change the answers: the figures read the currency
// of the report.
func TestS696CriteriaForeignBase(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-01"))

	for _, code := range []string{"QSTA3", "QSTB3"} {
		h.MustDo(
			http.MethodPost,
			"/api/v1/instruments",
			security(code, "stock"),
			http.StatusCreated,
			nil,
		)
	}

	h.SeedCompany(t, "QSTA3", listingX)

	usd := h.LoginAs("usd@example.com", locale.Locale{Language: "en", Region: "US"}, "USD")

	res := h.Call(usd, http.MethodPut, contributionPath, criteriaDraft())
	if res.Status != http.StatusOK {
		t.Fatalf("save: %d %s", res.Status, res.Body)
	}

	var got criterionPlan
	res.Decode(t, &got)
	expectS689(t, got)
}

func expectS689(t *testing.T, got criterionPlan) {
	t.Helper()

	c := got.Classes[0]
	if !reflect.DeepEqual(c.QuestionFacts, []string{"price_earnings_max", "roe_min", ""}) ||
		!reflect.DeepEqual(c.QuestionLimits, []string{"10", "0.2", ""}) {
		t.Fatalf("facts = %q, limits = %q", c.QuestionFacts, c.QuestionLimits)
	}

	a, b := c.Members[0], c.Members[1]
	want := []criterionDetail{
		{Value: "10", Date: "2026-09-30"},
		{Value: "0.23", Date: "2026-09-30"},
		{},
	}

	if !reflect.DeepEqual(a.FactAnswers, []string{"yes", "yes", "none"}) ||
		!reflect.DeepEqual(a.FactDetails, want) || a.FactsYear != nil {
		t.Fatalf("QSTA3 = %+v", a)
	}

	none := []criterionDetail{{Reason: "no_report"}, {Reason: "no_report"}, {}}
	if !reflect.DeepEqual(b.FactAnswers, repeat("none", 3)) ||
		!reflect.DeepEqual(b.FactDetails, none) {
		t.Fatalf("QSTB3 = %+v", b)
	}

	// QSTA3: two answers of equori; QSTB3: one of the investor.
	if *a.TargetBP != 6667 || *b.TargetBP != 3333 {
		t.Fatalf("targets = %d, %d", *a.TargetBP, *b.TargetBP)
	}
}

// criteriaDraft is one group of QSTA3 and QSTB3 with two limits and one question of the investor.
func criteriaDraft() map[string]any {
	class := questionClass(
		[]string{"P/L", "ROE", "Entendo o negócio?"},
		answerMember("QSTA3", false, false, false),
		answerMember("QSTB3", false, false, true),
	)
	class["question_facts"] = []string{"price_earnings_max", "roe_min", ""}
	class["question_limits"] = []string{"10.00", "0.2", ""}

	return map[string]any{"classes": []any{class}}
}

func execSQL(t *testing.T, h *apitest.Harness, sql string) {
	t.Helper()

	if _, err := h.Pool.Exec(t.Context(), sql); err != nil {
		t.Fatal(err)
	}
}
