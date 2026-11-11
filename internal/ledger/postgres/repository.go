package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// SQLSTATE codes mapped to domain errors.
const (
	foreignKeyViolation = "23503"
	uniqueViolation     = "23505"
)

var _ app.Repository = (*Repository)(nil)

// db is satisfied by *pgxpool.Pool and pgx.Tx (ADR 005).
type db interface {
	DBTX
	Begin(ctx context.Context) (pgx.Tx, error)
}

type Repository struct {
	db  db
	q   *Queries
	tx  pgx.Tx
	ins app.Instruments
}

// NewRepository reads amounts of securities with the scales of ins; nil serves currencies only.
func NewRepository(db db, ins app.Instruments) *Repository {
	r := &Repository{db: db, q: New(db), ins: ins}
	if tx, ok := db.(pgx.Tx); ok {
		r.tx = tx
	}

	return r
}

func (r *Repository) InTx(ctx context.Context, fn func(app.Repository) error) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		return fn(&Repository{db: tx, q: r.q.WithTx(tx), tx: tx, ins: r.ins})
	})
}

func (r *Repository) Publish(ctx context.Context, e outbox.Event) error {
	if r.tx == nil {
		return errors.New("publish outside a transaction")
	}

	return outbox.Insert(ctx, r.tx, e)
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}

	return err
}

func duplicate(err error, field string) error {
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return &domain.FieldError{Field: field, Message: "already exists", Err: domain.ErrValidation}
	}

	return err
}

// referenceError turns a composite foreign key violation into ErrUnknownAccount: the
// database refused a reference to a row of another book or a missing row (DD3).
func referenceError(err error) error {
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == foreignKeyViolation {
		return &domain.FieldError{Field: "reference", Message: "unknown reference: " + pgErr.ConstraintName, Err: domain.ErrUnknownAccount}
	}

	return err
}
