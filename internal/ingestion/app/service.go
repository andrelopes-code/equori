// Package app implements the ingestion use cases.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/registry"
)

var ErrNotFound = errors.New("not found")

type BatchKey struct {
	StartedAt time.Time `json:"gs"`
	ID        uuid.UUID `json:"gi"`
}

// ConnectionRef names a connection and its owner.
type ConnectionRef struct {
	BooksID int64
	ID      uuid.UUID
}

// Claim is a record of the file as stored, and whether an earlier import had stored it.
type Claim struct {
	Record  domain.ExternalRecord
	Existed bool
}

type Service struct {
	repo   Repository
	ledger Ledger
	// box is nil without EQUORI_SECRET_KEY: integrations are unavailable (ADR 008 K2).
	box   Sealer
	aggs  registry.Registry[Aggregator]
	now   func() time.Time
	today func(context.Context) time.Time
	// inBooks gives each scheduled sync the context of its book (BK20).
	inBooks func(ctx context.Context, booksID int64) (context.Context, error)
	admins  Admins
	columns ColumnSuggester
}

// Integrations are what aggregator integrations need; the zero value leaves them unavailable.
type Integrations struct {
	Box         Sealer
	Aggregators registry.Registry[Aggregator]
	// Now and Today are the instance's clock (ADR 005).
	Now   func() time.Time
	Today func(context.Context) time.Time
	// InBooks gives each scheduled sync the context of its book (BK20).
	InBooks func(ctx context.Context, booksID int64) (context.Context, error)
	Admins  Admins
	// Columns is nil when no language model is wired: a column suggestion is unavailable.
	Columns ColumnSuggester
}

func NewService(repo Repository, ledger Ledger, in Integrations) *Service {
	return &Service{
		repo:    repo,
		ledger:  ledger,
		box:     in.Box,
		aggs:    in.Aggregators,
		now:     in.Now,
		today:   in.Today,
		inBooks: in.InBooks,
		admins:  in.Admins,
		columns: in.Columns,
	}
}

// FollowPairing points the records that a ledger pairing moved to the kept transaction
// (P5b amendment A32); repeating it changes nothing.
func (s *Service) FollowPairing(
	ctx context.Context,
	booksID int64,
	kept uuid.UUID,
	recordIDs []uuid.UUID,
) error {
	return s.repo.MoveRecords(ctx, booksID, recordIDs, kept)
}

func (s *Service) Batch(ctx context.Context, booksID int64, id uuid.UUID) (domain.Batch, error) {
	return s.repo.Batch(ctx, booksID, id)
}

func (s *Service) ListBatches(
	ctx context.Context,
	booksID int64,
	p page.Request[BatchKey],
) ([]domain.Batch, *BatchKey, error) {
	return s.repo.ListBatches(ctx, booksID, p)
}
