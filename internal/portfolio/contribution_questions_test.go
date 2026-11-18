package portfolio_test

import (
	"net/http"
	"reflect"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type questionMemberOut struct {
	Instrument string    `json:"instrument"`
	TargetBP   *int      `json:"target_bp"`
	Answers    []bool    `json:"answers"`
	Amount     *moneyOut `json:"amount"`
}

type questionClassOut struct {
	Questions      []string            `json:"questions"`
	QuestionIdeals bool                `json:"question_ideals"`
	Amount         *moneyOut           `json:"amount"`
	Members        []questionMemberOut `json:"members"`
}

type questionPlanOut struct {
	Classes []questionClassOut `json:"classes"`
}

// newQuestionFixture holds three stocks that no trade touches: each member of the plan is worth
// zero and none lacks a price (CN10).
func newQuestionFixture(t *testing.T) contributionFixture {
	t.Helper()
	f := newContributionFixture(t)

	for _, code := range []string{"QSTA3", "QSTB3", "QSTC3"} {
		f.h.MustDo(
			http.MethodPost,
			"/api/v1/instruments",
			security(code, "stock"),
			http.StatusCreated,
			nil,
		)
	}

	return f
}

func questionClass(questions []string, members ...map[string]any) map[string]any {
	c := contributionClass("Questions", 10000, members...)
	c["questions"] = questions

	return c
}

func answerMember(code string, answers ...bool) map[string]any {
	return map[string]any{"instrument": code, "answers": answers}
}

// s604Draft is the plan of S604: three questions, answers (T,T,F) (T,F,F) (F,F,F).
func s604Draft() map[string]any {
	return map[string]any{
		"classes": []any{
			questionClass(
				[]string{"Q1", "Q2", "Q3"},
				answerMember("QSTA3", true, true, false),
				answerMember("QSTB3", true, false, false),
				answerMember("QSTC3", false, false, false),
			),
		},
	}
}

func expectS604(t *testing.T, got questionPlanOut) {
	t.Helper()

	if len(got.Classes) != 1 {
		t.Fatalf("classes = %+v", got.Classes)
	}

	c := got.Classes[0]
	if !reflect.DeepEqual(c.Questions, []string{"Q1", "Q2", "Q3"}) || !c.QuestionIdeals ||
		len(c.Members) != 3 {
		t.Fatalf("class = %+v", c)
	}

	wantTargets := []int{6667, 3333, 0}
	wantAnswers := [][]bool{{true, true, false}, {true, false, false}, {false, false, false}}

	for i, m := range c.Members {
		if m.TargetBP == nil || *m.TargetBP != wantTargets[i] ||
			!reflect.DeepEqual(m.Answers, wantAnswers[i]) {
			t.Fatalf("member %d = %+v (target %v)", i, m, m.TargetBP)
		}
	}
}

// S604: a save with questions stores them and returns the ideals derived from the answers.
func TestS604SaveQuestions(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	var saved questionPlanOut
	f.h.MustDo(http.MethodPut, contributionPath, s604Draft(), http.StatusOK, &saved)
	expectS604(t, saved)

	var got questionPlanOut
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &got)
	expectS604(t, got)
}

// S605: the preview of the draft of S604 splits 1,000.00 by the derived ideals.
func TestS605PreviewQuestions(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	body := s604Draft()
	body["amount"] = apitest.BRL(100000)

	var got questionPlanOut
	f.h.MustDo(http.MethodPost, contributionPath+"/preview", body, http.StatusOK, &got)

	expectS604(t, got)

	want := []int64{66670, 33330, 0}
	for i, m := range got.Classes[0].Members {
		if m.Amount == nil || m.Amount.Amount != want[i] {
			t.Fatalf("member %d amount = %+v, want %d", i, m.Amount, want[i])
		}
	}
}

// S606: with every answer false the group has no member ideals and one amount.
func TestS606EveryAnswerFalse(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	draft := map[string]any{
		"amount": apitest.BRL(100000),
		"classes": []any{
			questionClass(
				[]string{"Q1", "Q2"},
				answerMember("QSTA3", false, false),
				answerMember("QSTB3", false, false),
				answerMember("QSTC3", false, false),
			),
		},
	}

	for name, got := range map[string]questionPlanOut{
		"save": func() questionPlanOut {
			var out questionPlanOut
			f.h.MustDo(http.MethodPut, contributionPath, draft, http.StatusOK, &out)

			return out
		}(),
		"preview": func() questionPlanOut {
			var out questionPlanOut
			f.h.MustDo(http.MethodPost, contributionPath+"/preview", draft, http.StatusOK, &out)

			return out
		}(),
	} {
		c := got.Classes[0]
		if c.QuestionIdeals || len(c.Questions) != 2 {
			t.Fatalf("%s class = %+v", name, c)
		}

		for i, m := range c.Members {
			if m.TargetBP != nil || m.Amount != nil || len(m.Answers) != 2 {
				t.Fatalf("%s member %d = %+v", name, i, m)
			}
		}
	}

	var stored questionPlanOut
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &stored)

	if stored.Classes[0].QuestionIdeals || stored.Classes[0].Members[0].TargetBP != nil {
		t.Fatalf("stored class = %+v", stored.Classes[0])
	}
}

// S607: each invalid case of CQ7.5 and CQ7.6 returns its problem code.
func TestS607InvalidQuestions(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	eleven := make([]string, 11)
	for i := range eleven {
		eleven[i] = strings.Repeat("q", i+1)
	}

	tests := []struct {
		name  string
		class map[string]any
		code  string
	}{
		{
			name:  "question of 201 characters",
			class: questionClass([]string{strings.Repeat("a", 201)}, answerMember("QSTA3", true)),
			code:  "contribution_question_invalid",
		},
		{
			name:  "blank question",
			class: questionClass([]string{"  "}, answerMember("QSTA3", true)),
			code:  "contribution_question_invalid",
		},
		{
			name: "questions equal ignoring case",
			class: questionClass(
				[]string{"Paga dividendos?", "paga dividendos?"},
				answerMember("QSTA3", true, true),
			),
			code: "contribution_question_invalid",
		},
		{
			name:  "eleven questions",
			class: questionClass(eleven, answerMember("QSTA3", make([]bool, 11)...)),
			code:  "contribution_question_invalid",
		},
		{
			name: "two answers for three questions",
			class: questionClass(
				[]string{"Q1", "Q2", "Q3"},
				answerMember("QSTA3", true, false),
			),
			code: "contribution_answers_invalid",
		},
		{
			name: "target with questions",
			class: questionClass(
				[]string{"Q1"},
				map[string]any{"instrument": "QSTA3", "answers": []bool{true}, "target_bp": 10000},
			),
			code: "contribution_answers_invalid",
		},
		{
			name:  "answers without questions",
			class: contributionClass("Questions", 10000, answerMember("QSTA3", true)),
			code:  "contribution_answers_invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f.h.ExpectProblem(
				f.h.Do(
					http.MethodPut,
					contributionPath,
					map[string]any{"classes": []any{tt.class}},
				),
				http.StatusUnprocessableEntity,
				tt.code,
				"",
			)
		})
	}
}

// S608: a member with role read cannot save a plan with questions.
func TestS608ReaderCannotSaveQuestions(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodPut, contributionPath, s604Draft()),
		http.StatusForbidden,
		"book_role_required",
		"",
	)
}

// S609: save_contribution_plan with the plan of S604 stores the plan of S604.
func TestS609SaveQuestionsTool(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	var saved questionPlanOut
	toolOutput(t, f.h, "save_contribution_plan", s604Draft(), &saved)
	expectS604Tool(t, saved)

	var got questionPlanOut
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &got)
	expectS604(t, got)

	var read struct {
		Contribution questionPlanOut `json:"contribution"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "contribution"}, &read)
	expectS604Tool(t, read.Contribution)
}

// expectS604Tool reads the view of a tool, which leaves out a target of zero.
func expectS604Tool(t *testing.T, got questionPlanOut) {
	t.Helper()

	c := got.Classes[0]
	if !reflect.DeepEqual(c.Questions, []string{"Q1", "Q2", "Q3"}) || !c.QuestionIdeals ||
		len(c.Members) != 3 {
		t.Fatalf("class = %+v", c)
	}

	wantTargets := []int{6667, 3333, 0}
	wantAnswers := [][]bool{{true, true, false}, {true, false, false}, {false, false, false}}

	for i, m := range c.Members {
		target := 0
		if m.TargetBP != nil {
			target = *m.TargetBP
		}

		if target != wantTargets[i] || !reflect.DeepEqual(m.Answers, wantAnswers[i]) {
			t.Fatalf("member %d = %+v (target %v)", i, m, m.TargetBP)
		}
	}
}
