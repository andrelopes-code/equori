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
	// MoveRecords points the linked records among recordIDs to the transaction.
	MoveRecords(ctx context.Context, userID int64, recordIDs []uuid.UUID, transactionID uuid.UUID) error
	ListBatches(ctx context.Context, userID int64, p page.Request[BatchKey]) ([]domain.Batch, *BatchKey, error)
	Profile(ctx context.Context, userID int64, accountID uuid.UUID) (domain.Profile, error)
	// SaveProfile returns ErrNotFound when the account does not belong to the user.
	SaveProfile(ctx context.Context, p domain.Profile) (domain.Profile, error)
	// InsertBatch returns ErrNotFound when the account does not belong to the user.
	InsertBatch(ctx context.Context, b domain.Batch) (domain.Batch, error)
	// CompleteBatch stores the counts and the file balance and marks the batch complete.
	CompleteBatch(ctx context.Context, b domain.Batch) (domain.Batch, error)
	Batch(ctx context.Context, userID int64, id uuid.UUID) (domain.Batch, error)
	// ClaimRecords inserts the records in state received in one database transaction; a
	// record whose deduplication key exists comes back as stored, with Existed (I10).
	ClaimRecords(ctx context.Context, rs []domain.ExternalRecord) ([]Claim, error)
	// SaveOutcomes stores each record's batch, state, transaction and candidates in one
	// database transaction.
	SaveOutcomes(ctx context.Context, rs []domain.ExternalRecord) error
	Record(ctx context.Context, userID int64, id uuid.UUID) (domain.ExternalRecord, error)
	Records(ctx context.Context, userID int64, batchID uuid.UUID, state domain.RecordState, p page.Request[RecordKey]) ([]domain.ExternalRecord, *RecordKey, error)
	// ResolveRecord stores a reviewed record and moves it out of its batch's needs_review count.
	ResolveRecord(ctx context.Context, r domain.ExternalRecord) error
	// LockAccountImports serializes the imports of one account until unlock runs.
	LockAccountImports(ctx context.Context, accountID uuid.UUID) (unlock func(), err error)

	// InsertIntegration returns a *domain.FieldError on name when the user already has the name.
	InsertIntegration(ctx context.Context, i domain.Integration) (domain.Integration, error)
	Integration(ctx context.Context, userID int64, id uuid.UUID) (domain.Integration, error)
	ListIntegrations(ctx context.Context, userID int64, p page.Request[NameKey]) ([]domain.Integration, *NameKey, error)
	UpdateCredentials(ctx context.Context, userID int64, id uuid.UUID, sealed []byte) (domain.Integration, error)
	// DeleteIntegration returns ErrIntegrationInUse while a connection uses the integration.
	DeleteIntegration(ctx context.Context, userID int64, id uuid.UUID) error
	// ResealCredentials replaces, in one database transaction, every user's sealed
	// credentials for which reseal returns a value, and returns how many it replaced.
	ResealCredentials(ctx context.Context, reseal func(userID int64, id uuid.UUID, sealed []byte) ([]byte, error)) (int, error)
	// InsertConnection stores the connection and its accounts in one database transaction; a
	// *domain.FieldError on item_id when the integration already connects the item.
	InsertConnection(ctx context.Context, c domain.Connection) (domain.Connection, error)
	Connection(ctx context.Context, userID int64, id uuid.UUID) (domain.Connection, error)
	ListConnections(ctx context.Context, userID int64, p page.Request[NameKey]) ([]domain.Connection, *NameKey, error)
	DeleteConnection(ctx context.Context, userID int64, id uuid.UUID) error
	// SaveMapping returns a *domain.FieldError on account_id when another external account
	// feeds the ledger account.
	SaveMapping(ctx context.Context, a domain.ExternalAccount) (domain.ExternalAccount, error)
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
	box Sealer
	agg Aggregator
}

func NewService(repo Repository, ledger Ledger, box Sealer, agg Aggregator) *Service {
	return &Service{repo: repo, ledger: ledger, box: box, agg: agg}
}

// FollowPairing points the records that a ledger pairing moved to the kept transaction
// (P5b amendment A32); repeating it changes nothing.
func (s *Service) FollowPairing(ctx context.Context, userID int64, kept uuid.UUID, recordIDs []uuid.UUID) error {
	return s.repo.MoveRecords(ctx, userID, recordIDs, kept)
}

func (s *Service) Batch(ctx context.Context, userID int64, id uuid.UUID) (domain.Batch, error) {
	return s.repo.Batch(ctx, userID, id)
}

func (s *Service) ListBatches(ctx context.Context, userID int64, p page.Request[BatchKey]) ([]domain.Batch, *BatchKey, error) {
	return s.repo.ListBatches(ctx, userID, p)
}
