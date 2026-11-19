package httpapi

import (
	"errors"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/problem"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004);
// the module returns none of its own.
func ToProblem(err error) (problem.Details, bool) {
	if d, ok := contributionProblem(err); ok {
		return d, true
	}

	return reportProblem(err)
}

func reportProblem(err error) (problem.Details, bool) {
	if d, ok := rangeProblem(err); ok {
		return d, true
	}

	switch {
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "account not found"), true
	case errors.Is(err, app.ErrPriceMissing):
		return problem.New(http.StatusUnprocessableEntity, "price_missing", err.Error()), true
	case errors.Is(err, app.ErrUnknownIndex), errors.Is(err, app.ErrIndexNotDaily):
		d := problem.New(
			http.StatusBadRequest,
			"invalid_request",
			"the index must be an enabled daily index with stored rates",
		)
		d.Errors = []problem.FieldError{
			{Field: "index", Message: "must be an enabled daily index with stored rates"},
		}

		return d, true
	case errors.Is(err, app.ErrReturnUndefined):
		return problem.New(
			http.StatusUnprocessableEntity,
			"return_undefined",
			"no money was invested in the period, or the return has no solution",
		), true
	case errors.Is(err, app.ErrContributionPlanInvalid):
		return problem.New(
			http.StatusBadRequest,
			"invalid_request",
			"the plan breaks a limit of the contribution plan",
		), true
	}

	return problem.Details{}, false
}

var contributionProblems = []struct {
	err    error
	status int
	code   string
	detail string
}{
	{
		app.ErrContributionTargetSum, http.StatusUnprocessableEntity,
		"contribution_target_sum", "the class targets must add up to 10000 basis points",
	},
	{
		app.ErrContributionMemberTargetSum, http.StatusUnprocessableEntity,
		"contribution_member_target_sum",
		"the member targets of a class must all be set and add up to 10000, or all be absent",
	},
	{
		app.ErrContributionClassNameDuplicate, http.StatusUnprocessableEntity,
		"contribution_class_name_duplicate", "two classes have the same name",
	},
	{
		app.ErrContributionMemberDuplicate, http.StatusUnprocessableEntity,
		"contribution_member_duplicate", "an account or an instrument is in the plan twice",
	},
	{
		app.ErrContributionMemberInvalid, http.StatusUnprocessableEntity,
		"contribution_member_invalid",
		"a member is not an investment account or a security of the catalog",
	},
	{
		domain.ErrQuestionInvalid,
		http.StatusUnprocessableEntity,
		"contribution_question_invalid",
		"a question has 1 to 200 characters and differs from the others, and a group holds at most 10",
	},
	{
		domain.ErrAnswersInvalid, http.StatusUnprocessableEntity,
		"contribution_answers_invalid",
		"each member of a group with questions answers every question and has no target",
	},
	{
		domain.ErrRuleInvalid, http.StatusUnprocessableEntity,
		"contribution_rule_invalid",
		"a group holds members or 1 to 5 rules, and each rule sets valid conditions",
	},
	{
		app.ErrContributionAmountInvalid, http.StatusUnprocessableEntity,
		"contribution_amount_invalid", "the amount must be positive and in the base currency",
	},
	{
		app.ErrContributionPlanInvalid, http.StatusBadRequest,
		"invalid_request", "the plan breaks a limit of the contribution plan",
	},
}

func contributionProblem(err error) (problem.Details, bool) {
	for _, r := range contributionProblems {
		if errors.Is(err, r.err) {
			return problem.New(r.status, r.code, r.detail), true
		}
	}

	return problem.Details{}, false
}

func rangeProblem(err error) (problem.Details, bool) {
	switch {
	case errors.Is(err, app.ErrInvalidEventRange):
		d := problem.New(
			http.StatusUnprocessableEntity,
			"validation_failed",
			"from must not be after to, and the range must not exceed 400 days",
		)
		d.Errors = []problem.FieldError{
			{Field: "to", Message: "must be on or after from and at most 400 days after it"},
		}

		return d, true
	case errors.Is(err, app.ErrInvalidReturnRange):
		d := problem.New(
			http.StatusBadRequest,
			"invalid_request",
			"from must not be after to, and the period must not exceed 3660 days",
		)
		d.Errors = []problem.FieldError{
			{Field: "to", Message: "must be on or after from and at most 3659 days after it"},
		}

		return d, true
	case errors.Is(err, app.ErrInvalidDayRange):
		d := problem.New(
			http.StatusBadRequest,
			"invalid_request",
			"from must not be after to, and the range must not exceed 62 days",
		)
		d.Errors = []problem.FieldError{
			{Field: "to", Message: "must be on or after from and at most 61 days after it"},
		}

		return d, true
	}

	return problem.Details{}, false
}
