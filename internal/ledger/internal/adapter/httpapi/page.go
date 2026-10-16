package httpapi

import (
	"errors"

	"github.com/andrelopes-code/equori/internal/platform/page"
)

// listPage reads the limit and cursor parameters of a list (ADR 005, section 4).
func listPage[K any](limit *int, cursor *string) (page.Request[K], error) {
	r, err := page.Read[K](limit, cursor)
	switch {
	case errors.Is(err, page.ErrInvalidLimit):
		return r, &paramError{field: "limit", message: "must be between 1 and 200"}
	case errors.Is(err, page.ErrInvalidCursor):
		return r, &paramError{field: "cursor", message: "is not a cursor of this list"}
	}
	return r, err
}
