// Package toolapi declares the ingestion module's tools for language models (ADR 012).
package toolapi

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// AccountNames returns the names of the user's balance accounts by ID.
type AccountNames func(ctx context.Context, userID int64) (map[uuid.UUID]string, error)

func Tools(svc *app.Service, names AccountNames) []tool.Tool {
	return []tool.Tool{getImports(svc, names), manageImports(svc, names)}
}

func optionalID(s, field string) (uuid.UUID, error) {
	if s == "" {
		return uuid.Nil, nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, tool.InvalidArgument(field, "is not a UUID")
	}
	return id, nil
}

// field is an optional input and whether the call gave it.
type field struct {
	name  string
	given bool
}

// required reports a field the view or action needs, and rejects one it does not use.
func required(name string, fields []field, needed ...string) error {
	for _, f := range fields {
		switch {
		case slices.Contains(needed, f.name) && !f.given:
			return tool.InvalidArgument(f.name, "is required for "+name)
		case !slices.Contains(needed, f.name) && f.given:
			return tool.InvalidArgument(f.name, "is not used by "+name)
		}
	}
	return nil
}

func pageRequest[K any](args tool.PageArgs) (page.Request[K], error) {
	n, err := tool.Limit(args.Limit)
	if err != nil {
		return page.Request[K]{}, err
	}
	r := page.Request[K]{Limit: n}
	if args.Cursor != "" {
		var k K
		if page.DecodeCursor(args.Cursor, &k) != nil {
			return page.Request[K]{}, tool.InvalidArgument("cursor", "is not a next_cursor of this list; start again without cursor")
		}
		r.After = &k
	}
	return r, nil
}

func nextCursor[K any](k *K) (string, error) {
	if k == nil {
		return "", nil
	}
	return page.EncodeCursor(k)
}

func moneyOf(amount int64, currency string) (tool.Money, error) {
	m, err := money.New(amount, money.Currency(currency))
	if err != nil {
		return tool.Money{}, err
	}
	return tool.MoneyOf(m), nil
}
