package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/identity/app"
)

const (
	// uniqueViolation is the PostgreSQL SQLSTATE for unique_violation.
	uniqueViolation = "23505"
	// foreignKeyViolation is the PostgreSQL SQLSTATE for foreign_key_violation.
	foreignKeyViolation = "23503"
)

var _ app.Repository = (*Repository)(nil)

// db is satisfied by *pgxpool.Pool and pgx.Tx (ADR 005).
type db interface {
	DBTX
	Begin(ctx context.Context) (pgx.Tx, error)
}

type Repository struct {
	db db
	q  *Queries
}

func NewRepository(db db) *Repository {
	return &Repository{db: db, q: New(db)}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}

	return err
}
