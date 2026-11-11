package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

const (
	exclusionViolation = "23P01"
	uniqueViolation    = "23505"
)

var _ app.Repository = (*Repository)(nil)

// Repository runs on the pool, or on a transaction inside InTx.
type Repository struct {
	pool *pgxpool.Pool
	q    *Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool, q: New(pool)} }

// NewTxRepository runs on tx, as outbox handlers do.
func NewTxRepository(tx pgx.Tx) *Repository { return &Repository{q: New(tx)} }

func (r *Repository) InTx(ctx context.Context, fn func(app.Repository) error) error {
	if r.pool == nil {
		return fn(r)
	}

	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error { return fn(NewTxRepository(tx)) })
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}

	return err
}

func nullUUID(id uuid.UUID) uuid.NullUUID { return uuid.NullUUID{UUID: id, Valid: id != uuid.Nil} }

func intPtr(v int) *int32 {
	if v == 0 {
		return nil
	}

	n := int32(v) //nolint:gosec // rule fields are validated to small ranges (A48)

	return &n
}

func fromPtr(p *int32) int {
	if p == nil {
		return 0
	}

	return int(*p)
}

// keyset returns the cursor and the row limit of a page, one row more than asked so the
// page knows whether another follows.
func keyset(p page.Request[app.IDKey]) (uuid.NullUUID, int32) {
	var after uuid.NullUUID
	if p.After != nil {
		after = nullUUID(p.After.ID)
	}

	return after, int32(p.Limit + 1) //nolint:gosec // limit is at most page.MaxLimit
}

// trim cuts rows to the page and returns the key of its last row when another page follows.
func trim[R any](rows []R, limit int, id func(R) uuid.UUID) ([]R, *app.IDKey) {
	if len(rows) <= limit {
		return rows, nil
	}

	rows = rows[:limit]

	return rows, &app.IDKey{ID: id(rows[len(rows)-1])}
}
