// Package app implements the ingestion use cases.
package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/registry"
)

var ErrNotFound = errors.New("not found")

type BatchKey struct {
	StartedAt time.Time `json:"gs"`
	ID        uuid.UUID `json:"gi"`
}

// Repository returns ErrNotFound for missing rows.
type Repository interface {
	// MoveRecords points the linked records among recordIDs to the transaction.
	MoveRecords(ctx context.Context, booksID int64, recordIDs []uuid.UUID, transactionID uuid.UUID) error
	// CreatedRecords lists the account's records in state created dated in [from, to] (A167).
	CreatedRecords(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]domain.ExternalRecord, error)
	// GroupRecords lists the account's records in review reason group whose candidate is entry (A168).
	GroupRecords(ctx context.Context, booksID int64, accountID, entry uuid.UUID) ([]domain.ExternalRecord, error)
	ListBatches(ctx context.Context, booksID int64, p page.Request[BatchKey]) ([]domain.Batch, *BatchKey, error)
	Profile(ctx context.Context, booksID int64, accountID uuid.UUID) (domain.Profile, error)
	// SaveProfile returns ErrNotFound when the account does not belong to the book.
	SaveProfile(ctx context.Context, p domain.Profile) (domain.Profile, error)
	// InsertBatch returns ErrNotFound when the account does not belong to the book.
	InsertBatch(ctx context.Context, b domain.Batch) (domain.Batch, error)
	// CompleteBatch stores the counts and the file balance and marks the batch complete.
	CompleteBatch(ctx context.Context, b domain.Batch) (domain.Batch, error)
	Batch(ctx context.Context, booksID int64, id uuid.UUID) (domain.Batch, error)
	// ClaimRecords inserts the records in state received in one database transaction; a
	// record whose deduplication key exists comes back as stored, with Existed (I10).
	ClaimRecords(ctx context.Context, rs []domain.ExternalRecord) ([]Claim, error)
	// SaveOutcomes stores each record's batch, state, transaction and candidates in one
	// database transaction.
	SaveOutcomes(ctx context.Context, rs []domain.ExternalRecord) error
	Record(ctx context.Context, booksID int64, id uuid.UUID) (domain.ExternalRecord, error)
	Records(ctx context.Context, booksID int64, batchID uuid.UUID, state domain.RecordState, p page.Request[RecordKey]) ([]domain.ExternalRecord, *RecordKey, error)
	// ResolveRecord stores a reviewed record and moves it out of its batch's needs_review count.
	ResolveRecord(ctx context.Context, r domain.ExternalRecord) error
	// ReopenRecord returns a discarded record to review; false when it is not discarded.
	ReopenRecord(ctx context.Context, booksID int64, id, batchID uuid.UUID) (bool, error)
	// SaveUndo stores, in one database transaction, a record after the undo of its decision
	// decided, moves an undone record that entered review out of the count of left, and inserts
	// line, when not nil, as a new record in review (A148). ErrNoDecision when the record no
	// longer carries decided.
	SaveUndo(ctx context.Context, rec domain.ExternalRecord, decided domain.DecisionKind, left domain.RecordState, line *domain.ExternalRecord) error
	// SyncRuns lists the newest sync runs of the connection whose summary lists a record, at
	// most limit, with their batches and those records (A149).
	SyncRuns(ctx context.Context, booksID int64, connectionID uuid.UUID, limit int) ([]domain.SyncRun, error)
	// LockAccountImports serializes the imports of one account until unlock runs.
	LockAccountImports(ctx context.Context, accountID uuid.UUID) (unlock func(), err error)

	// SyncInterval returns the stored interval; false without a row.
	SyncInterval(ctx context.Context) (int, bool, error)
	SetSyncInterval(ctx context.Context, minutes int) error

	// InsertIntegration returns a *domain.FieldError on name when the book already has the name.
	InsertIntegration(ctx context.Context, i domain.Integration) (domain.Integration, error)
	Integration(ctx context.Context, booksID int64, id uuid.UUID) (domain.Integration, error)
	ListIntegrations(ctx context.Context, booksID int64, p page.Request[NameKey]) ([]domain.Integration, *NameKey, error)
	UpdateCredentials(ctx context.Context, booksID int64, id uuid.UUID, sealed []byte) (domain.Integration, error)
	// DeleteIntegration returns ErrIntegrationInUse while a connection uses the integration.
	DeleteIntegration(ctx context.Context, booksID int64, id uuid.UUID) error
	// StoredCredentials lists the book's integrations that hold a credential, by id.
	StoredCredentials(ctx context.Context, booksID int64) ([]domain.Integration, error)
	// ResealCredentials replaces, in one database transaction, every book's sealed
	// credentials for which reseal returns a value, and returns how many it replaced.
	ResealCredentials(ctx context.Context, reseal func(booksID int64, id uuid.UUID, sealed []byte) ([]byte, error)) (int, error)
	// InsertConnection stores the connection and its accounts in one database transaction; a
	// *domain.FieldError on external_id when the integration already connects the item.
	InsertConnection(ctx context.Context, c domain.Connection) (domain.Connection, error)
	Connection(ctx context.Context, booksID int64, id uuid.UUID) (domain.Connection, error)
	ListConnections(ctx context.Context, booksID int64, p page.Request[NameKey]) ([]domain.Connection, *NameKey, error)
	DeleteConnection(ctx context.Context, booksID int64, id uuid.UUID) error
	// InsertMissingExternalAccount stores the external account, pending, unless the connection
	// already has one with its external id.
	InsertMissingExternalAccount(ctx context.Context, a domain.ExternalAccount) error
	// AccountFeed reports where the account's institution lines start and end (A103).
	AccountFeed(ctx context.Context, booksID int64, accountID uuid.UUID) (domain.Feed, error)
	// RenameExternalAccount stores the name the institution now reports for the external
	// account, keeps the previous one among its former names (A94) and dates the new one (A212).
	RenameExternalAccount(ctx context.Context, booksID int64, id uuid.UUID, name string, from *time.Time, on time.Time) error
	// SetExternalAccountGone stores the date a listing first lacked the account, or clears it
	// with nil (A214).
	SetExternalAccountGone(ctx context.Context, booksID int64, id uuid.UUID, since *time.Time) error
	// ReplaceMapping saves both mappings in one database transaction: released gives up the
	// ledger account that mapped takes (A214).
	ReplaceMapping(ctx context.Context, released, mapped domain.ExternalAccount) (domain.ExternalAccount, error)
	// OpenReserveReviews counts the connection's lines waiting because no reserve resolves them
	// (A213).
	OpenReserveReviews(ctx context.Context, booksID int64, connectionID uuid.UUID) (int64, error)
	// SaveMapping returns a *domain.FieldError on account_id when another external account
	// feeds the ledger account.
	SaveMapping(ctx context.Context, a domain.ExternalAccount) (domain.ExternalAccount, error)

	// UpdateRecordFacts stores what an aggregator now reports about stored records.
	UpdateRecordFacts(ctx context.Context, recs []domain.ExternalRecord) error
	// RepeatableRecords lists the account's created or matched records booked in [from, to];
	// with filesOnly, only those of file batches (A215).
	RepeatableRecords(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time, filesOnly bool) ([]domain.ExternalRecord, error)
	// SyncedRecords lists the account's aggregator records booked in [from, to] that are
	// neither withdrawn nor discarded.
	SyncedRecords(ctx context.Context, booksID int64, accountID uuid.UUID, from, to time.Time) ([]domain.ExternalRecord, error)
	// RecordsByLineIDs lists the account's aggregator records whose external id or
	// institution line id is among the given ones (A143).
	RecordsByLineIDs(ctx context.Context, booksID int64, accountID uuid.UUID, externalIDs, institutionIDs []string) ([]domain.ExternalRecord, error)
	// Reidentify gives a record the external id, deduplication key and raw payload of a line,
	// as a decision of the batch's sync run (A143, A148).
	Reidentify(ctx context.Context, booksID int64, batchID, id uuid.UUID, externalID string, dedupKey []byte, raw map[string]string) error
	// WithdrawRecords marks records withdrawn by the batch's sync run, keeps what each was for
	// its undo, and takes them out of their batches' review counts (A38, A148).
	WithdrawRecords(ctx context.Context, booksID int64, batchID uuid.UUID, ids []uuid.UUID) error
	// MarkAccountSynced stores the account's last synced date and asserted balance.
	MarkAccountSynced(ctx context.Context, a domain.ExternalAccount) error
	// SaveConnectionState stores the connection's provider status, item update, last sync and error.
	SaveConnectionState(ctx context.Context, c domain.Connection) error
	// InstallmentPlans returns the ledger plans of the keys that have one, by key.
	InstallmentPlans(ctx context.Context, booksID int64, keys [][]byte) (map[string]uuid.UUID, error)
	SaveInstallmentPlan(ctx context.Context, booksID int64, accountID uuid.UUID, key []byte, planID uuid.UUID) error
	// AllConnections lists every book's connections, for the scheduler.
	AllConnections(ctx context.Context) ([]ConnectionRef, error)
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
	return &Service{repo: repo, ledger: ledger, box: in.Box, aggs: in.Aggregators, now: in.Now, today: in.Today, inBooks: in.InBooks, admins: in.Admins, columns: in.Columns}
}

// FollowPairing points the records that a ledger pairing moved to the kept transaction
// (P5b amendment A32); repeating it changes nothing.
func (s *Service) FollowPairing(ctx context.Context, booksID int64, kept uuid.UUID, recordIDs []uuid.UUID) error {
	return s.repo.MoveRecords(ctx, booksID, recordIDs, kept)
}

func (s *Service) Batch(ctx context.Context, booksID int64, id uuid.UUID) (domain.Batch, error) {
	return s.repo.Batch(ctx, booksID, id)
}

func (s *Service) ListBatches(ctx context.Context, booksID int64, p page.Request[BatchKey]) ([]domain.Batch, *BatchKey, error) {
	return s.repo.ListBatches(ctx, booksID, p)
}
