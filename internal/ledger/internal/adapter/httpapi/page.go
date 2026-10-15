package httpapi

import (
	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// listPage reads the limit and cursor parameters of a list (ADR 005, section 4).
func listPage[K any](limit *int, cursor *string) (app.Page[K], error) {
	n, err := page.Limit(limit)
	if err != nil {
		return app.Page[K]{}, &paramError{field: "limit", message: "must be between 1 and 200"}
	}
	p := app.Page[K]{Limit: n}
	if cursor != nil {
		var k K
		if err := page.DecodeCursor(*cursor, &k); err != nil {
			return app.Page[K]{}, &paramError{field: "cursor", message: "is not a cursor of this list"}
		}
		p.After = &k
	}
	return p, nil
}

// nextCursor encodes the key of the last returned row; nil on the last page.
func nextCursor[K any](k *K) (*string, error) {
	if k == nil {
		return nil, nil
	}
	c, err := page.EncodeCursor(k)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
