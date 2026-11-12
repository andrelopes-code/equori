package httpapi

import (
	"errors"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/problem"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004);
// the module returns none of its own.
func ToProblem(err error) (problem.Details, bool) {
	switch {
	case errors.Is(err, app.ErrInvalidReturnRange):
		d := problem.New(
			http.StatusBadRequest,
			"invalid_request",
			"from must not be after to, and the period must not exceed 366 days",
		)
		d.Errors = []problem.FieldError{
			{Field: "to", Message: "must be on or after from and at most 365 days after it"},
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
	}

	return problem.Details{}, false
}
