package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
)

// uniqueViolation is the PostgreSQL SQLSTATE for unique_violation.
const uniqueViolation = "23505"

var _ app.Repository = (*Repository)(nil)

type Repository struct {
	q *Queries
}

func NewRepository(db DBTX) *Repository {
	return &Repository{q: New(db)}
}

func (r *Repository) CreateUser(ctx context.Context, u domain.User) (domain.User, error) {
	row, err := r.q.CreateUser(ctx, CreateUserParams{
		Email:        u.Email,
		PasswordHash: u.PasswordHash,
		Role:         string(u.Role),
	})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return domain.User{}, app.ErrEmailTaken
	}
	if err != nil {
		return domain.User{}, err
	}
	return toUser(row), nil
}

func (r *Repository) UserByEmail(ctx context.Context, email string) (domain.User, error) {
	row, err := r.q.GetUserByEmail(ctx, email)
	if err != nil {
		return domain.User{}, notFound(err)
	}
	return toUser(row), nil
}

func (r *Repository) CreateSession(ctx context.Context, s domain.Session) error {
	return r.q.CreateSession(ctx, CreateSessionParams{
		TokenHash: s.TokenHash,
		UserID:    s.UserID,
		CreatedAt: s.CreatedAt,
		ExpiresAt: s.ExpiresAt,
	})
}

func (r *Repository) UserBySession(ctx context.Context, tokenHash []byte, now time.Time) (domain.User, error) {
	row, err := r.q.GetUserBySession(ctx, GetUserBySessionParams{TokenHash: tokenHash, ExpiresAt: now})
	if err != nil {
		return domain.User{}, notFound(err)
	}
	return toUser(row), nil
}

func (r *Repository) DeleteSession(ctx context.Context, tokenHash []byte) error {
	return r.q.DeleteSession(ctx, tokenHash)
}

func (r *Repository) DeleteExpiredSessions(ctx context.Context, now time.Time) error {
	return r.q.DeleteExpiredSessions(ctx, now)
}

func toUser(row IdentityUser) domain.User {
	return domain.User{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		Role:         domain.Role(row.Role),
		Disabled:     row.DisabledAt != nil,
	}
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}
	return err
}
