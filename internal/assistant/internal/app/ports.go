// Package app holds the use cases of the assistant module: providers, chains and their
// resolution (ADR 019).
package app

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

var (
	ErrSecretKeyMissing     = errors.New("EQUORI_SECRET_KEY is not set")
	ErrProviderUnauthorized = errors.New("the provider rejected the key")
	ErrProviderUnavailable  = errors.New("the provider did not answer")
)

type Repository interface {
	InsertProvider(ctx context.Context, p domain.Provider) error
	Provider(ctx context.Context, userID int64, id uuid.UUID) (domain.Provider, error)
	Providers(ctx context.Context, userID int64) ([]domain.Provider, error)
	UpdateProvider(ctx context.Context, p domain.Provider) error
	DeleteProvider(ctx context.Context, userID int64, id uuid.UUID) error
	Chains(ctx context.Context, userID int64) (map[string][]domain.ChainTarget, error)
	ReplaceChain(ctx context.Context, userID int64, useID string, targets []domain.ChainTarget) error
	ResealKeys(ctx context.Context, reseal func(userID int64, id uuid.UUID, sealed []byte) ([]byte, error)) (int, error)
	UsageRepository
}

// Sealer seals values bound to their row (ADR 008).
type Sealer interface {
	Seal(plaintext, associated []byte) ([]byte, error)
	Open(sealed, associated []byte) ([]byte, error)
	NeedsReseal(sealed []byte) bool
}

// ModelLister asks a provider's API for its models. Errors wrap ErrProviderUnauthorized or
// ErrProviderUnavailable.
type ModelLister interface {
	Models(ctx context.Context, api domain.API, baseURL, key string) ([]string, error)
}
