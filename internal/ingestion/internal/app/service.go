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
	// InsertMissingExternalAccount stores the external account, pending, unless the connection
	// already has one with its external id.
	InsertMissingExternalAccount(ctx context.Context, a domain.ExternalAccount) error
	// SaveMapping returns a *domain.FieldError on account_id when another external account
	// feeds the ledger account.
	SaveMapping(ctx context.Context, a domain.ExternalAccount) (domain.ExternalAccount, error)

	// UpdateRecordFacts stores what an aggregator now reports about stored records.
	UpdateRecordFacts(ctx context.Context, recs []domain.ExternalRecord) error
	// SyncedRecords lists the account's aggregator records booked in [from, to] that are
	// neither withdrawn nor discarded.
	SyncedRecords(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]domain.ExternalRecord, error)
	// WithdrawRecords marks records withdrawn and takes them out of their batches' review counts.
	WithdrawRecords(ctx context.Context, userID int64, ids []uuid.UUID) error
	// MarkAccountSynced stores the account's last synced date and asserted balance.
	MarkAccountSynced(ctx context.Context, a domain.ExternalAccount) error
	// SaveConnectionState stores the connection's provider status, item update, last sync and error.
	SaveConnectionState(ctx context.Context, c domain.Connection) error
	// InstallmentPlans returns the ledger plans of the keys that have one, by key.
	InstallmentPlans(ctx context.Context, userID int64, keys [][]byte) (map[string]uuid.UUID, error)
	SaveInstallmentPlan(ctx context.Context, userID int64, accountID uuid.UUID, key []byte, planID uuid.UUID) error
	// AllConnections lists every user's connections, for the scheduler.
	AllConnections(ctx context.Context) ([]ConnectionRef, error)
}

// ConnectionRef names a connection and its owner.
type ConnectionRef struct {
	UserID int64
	ID     uuid.UUID
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
	agg   Aggregator
	now   func() time.Time
	today func() time.Time
}

// Integrations are what aggregator integrations need; the zero value leaves them unavailable.
type Integrations struct {
	Box        Sealer
	Aggregator Aggregator
	// Now and Today are the instance's clock (ADR 005).
	Now, Today func() time.Time
}

func NewService(repo Repository, ledger Ledger, in Integrations) *Service {
	return &Service{repo: repo, ledger: ledger, box: in.Box, agg: in.Aggregator, now: in.Now, today: in.Today}
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
