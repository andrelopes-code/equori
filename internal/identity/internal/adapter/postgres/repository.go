package postgres

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// uniqueViolation is the PostgreSQL SQLSTATE for unique_violation.
const uniqueViolation = "23505"

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

const userCreatedEvent = "identity.user_created.v1"

type userCreated struct {
	UserID int64  `json:"user_id"`
	Email  string `json:"email"`
}

// CreateUser publishes identity.user_created.v1 in the same transaction.
func (r *Repository) CreateUser(ctx context.Context, u domain.User) (domain.User, error) {
	var created domain.User
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		row, err := r.q.WithTx(tx).CreateUser(ctx, CreateUserParams{
			Email:        u.Email,
			PasswordHash: u.PasswordHash,
			Role:         string(u.Role),
		})
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
			return app.ErrEmailTaken
		}
		if err != nil {
			return err
		}
		created = toUser(row)
		return outbox.Insert(ctx, tx, outbox.Event{
			Type:        userCreatedEvent,
			UserID:      row.ID,
			AggregateID: strconv.FormatInt(row.ID, 10),
			Payload:     userCreated{UserID: row.ID, Email: row.Email},
		})
	})
	if err != nil {
		return domain.User{}, err
	}
	return created, nil
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
