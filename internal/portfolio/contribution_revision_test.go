package portfolio_test

import (
	"net/http"
	"reflect"
	"testing"
)

// S728: a save without the optional fields keeps the dates, effects, reminders, overrides and
// releases of the stored plan (CO16).
func TestS728SaveWithoutOptionalFieldsKeeps(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	full := holdDraft(false)
	class := full["classes"].([]any)[2].(map[string]any)
	class["question_reviews"] = []int{3}

	member := class["members"].([]any)[0].(map[string]any)
	member["answer_dates"] = []string{"2026-10-12"}
	member["answer_overrides"] = []bool{false}
	member["released"] = true

	var first conditionPlan
	f.h.MustDo(http.MethodPut, contributionPath, full, http.StatusOK, &first)

	f.h.MustDo(http.MethodPut, contributionPath, bareDraft(), http.StatusOK, nil)

	var got conditionPlan
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &got)

	c, m := got.Classes[2], got.Classes[2].Members[0]
	if !reflect.DeepEqual(c.QuestionEffects, []string{"hold"}) ||
		!reflect.DeepEqual(c.QuestionReviews, []int{3}) || !m.Released ||
		!reflect.DeepEqual(m.AnswerOverrides, []bool{false}) ||
		len(m.AnswerDates) != 1 || m.AnswerDates[0] == nil || *m.AnswerDates[0] != "2026-10-12" {
		t.Fatalf("class %+v member %+v", c, m)
	}
}

// S729: a save over an unread plan returns 409 and stores nothing (CO15).
func TestS729Revision(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	var got conditionPlan
	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &got)

	if got.Revision != 0 {
		t.Fatalf("revision without a plan = %d", got.Revision)
	}

	first := f.saveRevision(t, 0, http.StatusOK)
	if first.Revision != 1 {
		t.Fatalf("first revision = %d", first.Revision)
	}

	second := f.saveRevision(t, 1, http.StatusOK)
	if second.Revision != 2 {
		t.Fatalf("second revision = %d", second.Revision)
	}

	for _, stale := range []int64{1, 0} {
		f.h.ExpectProblem(
			f.h.Do(http.MethodPut, contributionPath, withRevision(bareDraft(), stale)),
			http.StatusConflict,
			"contribution_plan_changed",
			"",
		)
	}

	f.h.MustDo(http.MethodGet, contributionPath, nil, http.StatusOK, &got)

	if got.Revision != 2 {
		t.Fatalf("revision after the refused saves = %d", got.Revision)
	}

	f.h.MustDo(http.MethodPut, contributionPath, bareDraft(), http.StatusOK, &got)

	if got.Revision != 3 {
		t.Fatalf("revision of a save without one = %d", got.Revision)
	}
}

// A reader cannot save the new fields; an unknown effect or reminder is an invalid request; a
// list of another length is a refused question (CO15, API).
func TestConditionInputRefused(t *testing.T) {
	t.Parallel()
	f := newQuestionFixture(t)

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodPut, contributionPath, holdDraft(false)),
		http.StatusForbidden,
		"book_role_required",
		"",
	)

	for name, set := range map[string]func(map[string]any){
		"effect":   func(c map[string]any) { c["question_effects"] = []string{"block"} },
		"reminder": func(c map[string]any) { c["question_reviews"] = []int{2} },
	} {
		draft := holdDraft(false)
		set(draft["classes"].([]any)[2].(map[string]any))

		res := f.h.Do(http.MethodPut, contributionPath, draft)
		if res.Status != http.StatusBadRequest {
			t.Fatalf("%s: %d %s", name, res.Status, res.Body)
		}
	}

	draft := holdDraft(false)
	draft["classes"].([]any)[2].(map[string]any)["question_effects"] = []string{"hold", "warn"}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPut, contributionPath, draft),
		http.StatusUnprocessableEntity,
		questionInvalid,
		"",
	)
}

// bareDraft is holdDraft without any of the optional fields of the conditions.
func bareDraft() map[string]any {
	draft := holdDraft(false)
	class := draft["classes"].([]any)[2].(map[string]any)
	delete(class, "question_effects")
	class["members"] = []any{map[string]any{"instrument": "QSTC3", "answers": []any{false}}}

	return draft
}

func withRevision(draft map[string]any, revision int64) map[string]any {
	draft["revision"] = revision

	return draft
}

func (f contributionFixture) saveRevision(t *testing.T, revision int64, status int) conditionPlan {
	t.Helper()

	var out conditionPlan
	f.h.MustDo(
		http.MethodPut,
		contributionPath,
		withRevision(bareDraft(), revision),
		status,
		&out,
	)

	return out
}
