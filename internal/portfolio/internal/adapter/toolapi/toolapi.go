// Package toolapi declares the portfolio module's tools for language models (ADR 012).
package toolapi

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/app"
)

// AccountNames returns the names of the user's accounts by ID.
type AccountNames func(ctx context.Context, userID int64) (map[uuid.UUID]string, error)

func Tools(svc *app.Service, names AccountNames, today func() time.Time) []tool.Tool {
	return []tool.Tool{getPortfolio(svc, names, today), getTaxYear(svc, names)}
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

// required reports a field the view needs, and rejects one it does not use.
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
