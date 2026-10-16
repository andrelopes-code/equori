// Package app implements the ingestion use cases.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var ErrNotFound = errors.New("not found")

type BatchKey struct {
	StartedAt time.Time `json:"gs"`
	ID        uuid.UUID `json:"gi"`
}

// Repository returns ErrNotFound for missing rows.
type Repository interface {
	ListBatches(ctx context.Context, userID int64, p page.Request[BatchKey]) ([]domain.Batch, *BatchKey, error)
	Profile(ctx context.Context, userID int64, accountID uuid.UUID) (domain.Profile, error)
	// SaveProfile returns ErrNotFound when the account does not belong to the user.
	SaveProfile(ctx context.Context, p domain.Profile) (domain.Profile, error)
	// InsertBatch returns ErrNotFound when the account does not belong to the user.
	InsertBatch(ctx context.Context, b domain.Batch) (domain.Batch, error)
	// CompleteBatch stores the counts and the file balance and marks the batch complete.
	CompleteBatch(ctx context.Context, b domain.Batch) (domain.Batch, error)
	Batch(ctx context.Context, userID int64, id uuid.UUID) (domain.Batch, error)
	// ClaimRecord inserts the record in state received, or returns the record that already
	// has its deduplication key with existed true (I10).
	ClaimRecord(ctx context.Context, r domain.ExternalRecord) (rec domain.ExternalRecord, existed bool, err error)
	// SaveOutcome stores the record's batch, state, transaction and candidates.
	SaveOutcome(ctx context.Context, r domain.ExternalRecord) error
	// LockAccountImports serializes the imports of one account until unlock runs.
	LockAccountImports(ctx context.Context, accountID uuid.UUID) (unlock func(), err error)
}

type Service struct {
	repo   Repository
	ledger Ledger
}

func NewService(repo Repository, ledger Ledger) *Service {
	return &Service{repo: repo, ledger: ledger}
}

func (s *Service) Batch(ctx context.Context, userID int64, id uuid.UUID) (domain.Batch, error) {
	return s.repo.Batch(ctx, userID, id)
}

func (s *Service) ListBatches(ctx context.Context, userID int64, p page.Request[BatchKey]) ([]domain.Batch, *BatchKey, error) {
	return s.repo.ListBatches(ctx, userID, p)
}
