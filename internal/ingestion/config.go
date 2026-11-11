package ingestion

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
)

type Config struct {
	// SecretKey and PreviousSecretKey are 32 raw bytes each (ADR 008); without SecretKey
	// integrations are unavailable.
	SecretKey, PreviousSecretKey string
	// URLs holds, by aggregator identifier, the only address its requests go to (N17); an
	// aggregator without an entry uses its own default.
	URLs  map[string]string
	Clock clock.Clock
	// InBooks gives each scheduled sync the context of its book (BK20).
	InBooks func(ctx context.Context, booksID int64) (context.Context, error)
	Admins  Admins
	// Router answers the column suggestion; nil leaves it unavailable.
	Router *llm.Router
}

// Admins tells whether a member holds the admin instance role; identity implements it.
type Admins interface {
	IsAdmin(ctx context.Context, memberID int64) (bool, error)
}

// AggregatorIDs lists the aggregators this build offers, in ascending order.
func AggregatorIDs() []string { return []string{"pluggy"} }
