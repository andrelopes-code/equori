package portfolio_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type conditionMember struct {
	Instrument      string            `json:"instrument"`
	TargetBP        *int              `json:"target_bp"`
	AnswerDates     []*string         `json:"answer_dates"`
	AnswerOverrides []bool            `json:"answer_overrides"`
	FactAnswers     []string          `json:"fact_answers"`
	FactDetails     []criterionDetail `json:"fact_details"`
	Released        bool              `json:"released"`
	Held            bool              `json:"held"`
	HeldBy          []int             `json:"held_by"`
	WarnedBy        []int             `json:"warned_by"`
	Due             []int             `json:"due"`
	Amount          *moneyOut         `json:"amount"`
	Forgone         *moneyOut         `json:"forgone"`
	Quantity        *moneyOut         `json:"quantity"`
	Cost            *moneyOut         `json:"cost"`
}

type conditionClass struct {
	Name            string            `json:"name"`
	QuestionEffects []string          `json:"question_effects"`
	QuestionReviews []int             `json:"question_reviews"`
	Held            bool              `json:"held"`
	Amount          *moneyOut         `json:"amount"`
	Forgone         *moneyOut         `json:"forgone"`
	Members         []conditionMember `json:"members"`
}

type conditionPlan struct {
	Revision     int64            `json:"revision"`
	HoldsIgnored bool             `json:"holds_ignored"`
	Status       string           `json:"status"`
	Leftover     *moneyOut        `json:"leftover"`
	Classes      []conditionClass `json:"classes"`
}

// S720: a hold sends the money of the held group to the other groups; the member states what it
// gives up (CO9, CO14). The stored plan, read without an amount, states the hold and no figure.
func TestS720HoldSendsTheMoneyOn(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	got := f.conditions(t, withAmount(holdDraft(false)))
	if !reflect.DeepEqual(got.amounts(), []int64{62500, 37500, 0}) {
		t.Fatalf("amounts = %v", got.amounts())
	}

	c := got.Classes[2]
	if !c.Held || got.HoldsIgnored || !reflect.DeepEqual(c.Members[0].HeldBy, []int{0}) {
		t.Fatalf("class C = %+v, ignored %v", c, got.HoldsIgnored)
	}

	if c.Members[0].Forgone == nil || c.Members[0].Forgone.Amount != 20000 {
		t.Fatalf("forgone = %+v", c.Members[0].Forgone)
	}

	f.h.MustDo(http.MethodPut, contributionPath, holdDraft(false), http.StatusOK, nil)

	var stored conditionPlan
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &stored)

	if !stored.Classes[2].Held || stored.Classes[2].Members[0].Forgone != nil {
		t.Fatalf("stored class C = %+v", stored.Classes[2])
	}
}

// S721: a hold inside a group moves the part of the held member to the other member (CO9).
func TestS721HoldInsideAGroup(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	class := questionClass(
		[]string{"Medo?"},
		answerMember("QSTA3", false),
		answerMember("QSTB3", true),
	)
	class["question_effects"] = []string{"hold"}

	class["members"].([]map[string]any)[0]["target_bp"] = 6000
	class["members"].([]map[string]any)[1]["target_bp"] = 4000

	body := map[string]any{"amount": apitest.BRL(100000), "classes": []any{class}}
	got := f.conditions(t, body)
	a, b := got.Classes[0].Members[0], got.Classes[0].Members[1]

	if a.Amount.Amount != 0 || b.Amount.Amount != 100000 || a.Forgone.Amount != 60000 {
		t.Fatalf("members = %+v %+v", a, b)
	}

	if got.Classes[0].Held || *a.TargetBP != 6000 || *b.TargetBP != 4000 {
		t.Fatalf("class = %+v", got.Classes[0])
	}
}

// S722: a member without an answer is not held.
func TestS722NoAnswerIsNotHeld(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	got := f.conditions(t, withAmount(holdDraft(nil)))
	if !reflect.DeepEqual(got.amounts(), []int64{50000, 30000, 20000}) {
		t.Fatalf("amounts = %v", got.amounts())
	}

	if got.Classes[2].Held || got.Classes[2].Members[0].Held {
		t.Fatalf("class C = %+v", got.Classes[2])
	}
}

// S723: a criterion with a limit key and no limit is stored and counts for nothing (CO2).
func TestS723IncompleteCriterion(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	class := questionClass(
		[]string{"P/L"},
		answerMember("QSTA3", false),
		answerMember("QSTB3", false),
	)
	class["question_facts"] = []string{"price_earnings_max"}
	class["question_limits"] = []string{""}
	class["question_effects"] = []string{"hold"}

	var saved conditionPlan
	f.h.MustDo(
		http.MethodPut,
		contributionPath,
		map[string]any{"classes": []any{class}},
		http.StatusOK,
		&saved,
	)

	for _, m := range saved.Classes[0].Members {
		want := []criterionDetail{{Reason: "no_limit"}}
		if !reflect.DeepEqual(m.FactAnswers, []string{"none"}) ||
			!reflect.DeepEqual(m.FactDetails, want) || m.Held {
			t.Fatalf("member = %+v", m)
		}
	}
}

// S724: a release holds for the month and ends with it; false takes it back (CO8).
func TestS724Release(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	released := withAmount(holdDraft(false))
	setReleased(released, true)

	got := f.conditions(t, released)
	if !reflect.DeepEqual(got.amounts(), []int64{50000, 30000, 20000}) || got.Classes[2].Held {
		t.Fatalf("released = %v, class %+v", got.amounts(), got.Classes[2])
	}

	f.h.MustDo(http.MethodPut, contributionPath, released, http.StatusOK, nil)

	var stored conditionPlan
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &stored)

	if !stored.Classes[2].Members[0].Released || stored.Classes[2].Held {
		t.Fatalf("stored = %+v", stored.Classes[2])
	}

	execSQL(t, f.h, `UPDATE portfolio_contribution_member SET release_month = '2026-10-01'
		WHERE instrument = 'QSTC3'`)

	got = f.conditions(t, withAmount(holdDraft(false)))
	if !reflect.DeepEqual(got.amounts(), []int64{62500, 37500, 0}) ||
		got.Classes[2].Members[0].Released {
		t.Fatalf("last month = %v", got.amounts())
	}

	setReleased(released, false)

	got = f.conditions(t, released)
	if !reflect.DeepEqual(got.amounts(), []int64{62500, 37500, 0}) {
		t.Fatalf("taken back = %v", got.amounts())
	}
}

// S725: with every group held the split ignores the holds and says so (CO13).
func TestS725EveryGroupHeld(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	var classes []any

	for _, code := range []string{"QSTA3", "QSTB3", "QSTC3"} {
		c := questionClass([]string{"Medo?"}, answerMember(code, false))
		c["name"] = code
		c["question_effects"] = []string{"hold"}
		classes = append(classes, c)
	}

	classes[0].(map[string]any)["target_bp"] = 5000
	classes[1].(map[string]any)["target_bp"] = 3000
	classes[2].(map[string]any)["target_bp"] = 2000

	got := f.conditions(t, map[string]any{"amount": apitest.BRL(100000), "classes": classes})
	if !reflect.DeepEqual(got.amounts(), []int64{50000, 30000, 20000}) || !got.HoldsIgnored {
		t.Fatalf("amounts = %v, ignored %v", got.amounts(), got.HoldsIgnored)
	}

	for _, c := range got.Classes {
		if !c.Held || c.Forgone != nil || c.Members[0].Forgone != nil {
			t.Fatalf("class = %+v", c)
		}
	}
}

// S726: a held asset takes no step of the leftover (CO12). PETR4 at 30.01 takes 1,000.00: 33
// units, cost 99033, leftover 967; MXRF11 at 5.00 would fit one unit of 500 and is held.
func TestS726LeftoverSkipsHeld(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)

	for code, value := range map[string]string{"PETR4": "30.01", "MXRF11": "5.00"} {
		f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
			"instrument":       code,
			"quote_instrument": "BRL",
			"date":             "2026-10-31",
			"value":            value,
		}, http.StatusCreated, nil)
	}

	held := contributionClass("Real estate funds", 5000, instrumentMember("MXRF11", 10000))
	held["questions"] = []string{"Medo?"}
	held["question_effects"] = []string{"hold"}
	held["members"] = []any{map[string]any{
		"instrument": "MXRF11",
		"target_bp":  10000,
		"answers":    []any{false},
	}}

	got := f.conditions(t, map[string]any{
		"amount": apitest.BRL(100000),
		"classes": []any{
			contributionClass("Domestic stocks", 5000, instrumentMember("PETR4", 10000)),
			held,
		},
	})
	petr, mxrf := got.Classes[0].Members[0], got.Classes[1].Members[0]

	if petr.Quantity.Amount != 33 || petr.Cost.Amount != 99033 {
		t.Fatalf("PETR4 = %+v %+v", petr.Quantity, petr.Cost)
	}

	if mxrf.Quantity.Amount != 0 || mxrf.Cost.Amount != 0 || got.Leftover.Amount != 967 {
		t.Fatalf("MXRF11 = %+v %+v, leftover %+v", mxrf.Quantity, mxrf.Cost, got.Leftover)
	}
}

// A group of two assets without ideals is held when both are, states what it gives up and takes no
// leftover; with one held it receives its amount (CO9, CO11, CO12, CO14). PETR4 at 30.01 takes
// 1,000.00: 33 units, cost 99033, leftover 967.
func TestUndividedGroupHeld(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       "PETR4",
		"quote_instrument": "BRL",
		"date":             "2026-10-31",
		"value":            "30.01",
	}, http.StatusCreated, nil)

	draft := func(second bool) map[string]any {
		pair := questionClass(
			[]string{"Medo?"},
			answerMember("QSTA3", false),
			answerMember("QSTB3", second),
		)
		pair["target_bp"] = 5000
		pair["question_effects"] = []string{"hold"}

		return withAmount(map[string]any{"classes": []any{
			contributionClass("Domestic stocks", 5000, instrumentMember("PETR4", 10000)),
			pair,
		}})
	}

	got := f.conditions(t, draft(false))
	pair := got.Classes[1]

	if !reflect.DeepEqual(got.amounts(), []int64{100000, 0}) || !pair.Held ||
		pair.Forgone == nil || pair.Forgone.Amount != 50000 || got.Leftover.Amount != 967 {
		t.Fatalf("amounts %v, pair %+v, leftover %+v", got.amounts(), pair, got.Leftover)
	}

	got = f.conditions(t, draft(true))
	if !reflect.DeepEqual(got.amounts(), []int64{50000, 50000}) || got.Classes[1].Held ||
		got.Classes[1].Forgone != nil || got.Leftover.Amount != 0 {
		t.Fatalf("one held: amounts %v, pair %+v", got.amounts(), got.Classes[1])
	}
}

// S727: an answer is due once its reminder has run, and a due answer still holds (CO7).
func TestS727DueAnswers(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	for date, want := range map[string][]int{"2026-10-31": {0}, "2026-11-01": nil} {
		draft := holdDraft(false)
		class := draft["classes"].([]any)[2].(map[string]any)
		class["question_reviews"] = []int{1}
		class["members"].([]any)[0].(map[string]any)["answer_dates"] = []string{date}

		got := f.conditions(t, draft)
		m := got.Classes[2].Members[0]

		if !reflect.DeepEqual(m.Due, want) || !m.Held {
			t.Fatalf("answered %s: due %v held %v", date, m.Due, m.Held)
		}
	}
}

// S730: an override of a fact answer decides the hold (CO3, CO4). The filings answer yes to a
// P/L of 11.00 for QSTA3.
func TestS730OverrideOfAFact(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)
	f.h.SeedCompany(t, "QSTA3", listingX)

	for override, held := range map[bool]bool{true: true, false: false} {
		class := questionClass([]string{"P/L"}, answerMember("QSTA3", false))
		class["question_facts"] = []string{"price_earnings_max"}
		class["question_limits"] = []string{"11.00"}
		class["question_effects"] = []string{"hold"}
		class["members"].([]map[string]any)[0]["answer_overrides"] = []bool{override}

		var got conditionPlan
		f.h.MustDo(
			http.MethodPut,
			contributionPath,
			map[string]any{"classes": []any{class}},
			http.StatusOK,
			&got,
		)

		m := got.Classes[0].Members[0]
		if !reflect.DeepEqual(m.FactAnswers, []string{"yes"}) || m.Held != held {
			t.Fatalf("override %v: %+v", override, m)
		}
	}
}

// S731: typed ideals stay beside a criterion that holds and are refused beside one that weighs
// (CO5).
func TestS731TypedIdealsBesideEffects(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	typed := func(effect string) map[string]any {
		class := questionClass(
			[]string{"Medo?"},
			answerMember("QSTA3", true),
			answerMember("QSTB3", true),
		)
		class["question_effects"] = []string{effect}
		class["members"].([]map[string]any)[0]["target_bp"] = 6000
		class["members"].([]map[string]any)[1]["target_bp"] = 4000

		return map[string]any{"classes": []any{class}}
	}

	var got conditionPlan
	f.h.MustDo(http.MethodPut, contributionPath, typed("hold"), http.StatusOK, &got)

	if *got.Classes[0].Members[0].TargetBP != 6000 || *got.Classes[0].Members[1].TargetBP != 4000 {
		t.Fatalf("saved = %+v", got.Classes[0].Members)
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPut, contributionPath, typed("weigh")),
		http.StatusUnprocessableEntity,
		"contribution_answers_invalid",
		"",
	)
}

// A held asset without a price leaves the plan incomplete and is still stated held (CO9, CN10).
func TestHeldAssetWithoutPrice(t *testing.T) {
	t.Parallel()
	f := newContributionFixture(t)

	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("KNRI11", "reit"),
		http.StatusCreated,
		nil,
	)
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      f.holdingAccount("KNRI11"),
		"cash_account_id": f.cash,
		"side":            "buy",
		"date":            "2026-10-10",
		"quantity":        units(5, "KNRI11"),
		"unit_price":      "100.00",
	}, http.StatusCreated, nil)
	f.h.Dispatch()

	class := contributionClass("Real estate funds", 10000, instrumentMember("KNRI11"))
	class["questions"] = []string{"Medo?"}
	class["question_effects"] = []string{"hold"}
	class["members"] = []any{map[string]any{"instrument": "KNRI11", "answers": []any{false}}}

	got := f.conditions(t, map[string]any{
		"amount":  apitest.BRL(100000),
		"classes": []any{class},
	})
	if got.Status != "incomplete" || !got.Classes[0].Members[0].Held {
		t.Fatalf("status %q, member %+v", got.Status, got.Classes[0].Members[0])
	}
}

// holdDraft is three groups of one asset each, 5000, 3000 and 2000, the last with the criterion
// "Medo?" of effect hold answered with answer.
func holdDraft(answer any) map[string]any {
	last := contributionClass("C", 2000, instrumentMember("QSTC3"))
	last["questions"] = []string{"Medo?"}
	last["question_effects"] = []string{"hold"}
	last["members"] = []any{map[string]any{"instrument": "QSTC3", "answers": []any{answer}}}

	return map[string]any{"classes": []any{
		contributionClass("A", 5000, instrumentMember("QSTA3")),
		contributionClass("B", 3000, instrumentMember("QSTB3")),
		last,
	}}
}

func setReleased(draft map[string]any, released bool) {
	class := draft["classes"].([]any)[2].(map[string]any)
	class["members"].([]any)[0].(map[string]any)["released"] = released
}

func withAmount(draft map[string]any) map[string]any {
	draft["amount"] = apitest.BRL(100000)

	return draft
}

func (f contributionFixture) conditions(t *testing.T, body map[string]any) conditionPlan {
	t.Helper()

	var out conditionPlan
	f.h.MustDo(http.MethodPost, contributionPath+"/preview", body, http.StatusOK, &out)

	return out
}

func (p conditionPlan) amounts() []int64 {
	out := make([]int64, len(p.Classes))
	for i, c := range p.Classes {
		out[i] = -1
		if c.Amount != nil {
			out[i] = c.Amount.Amount
		}
	}

	return out
}
