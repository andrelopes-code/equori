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
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
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

const userCreatedEvent = "identity.user_created.v2"

type userCreated struct {
	UserID       int64          `json:"user_id"`
	Email        string         `json:"email"`
	Language     string         `json:"language"`
	Region       string         `json:"region"`
	BaseCurrency money.Currency `json:"base_currency"`
}

// CreateUser publishes identity.user_created.v2 in the same transaction.
func (r *Repository) CreateUser(ctx context.Context, u domain.User, base money.Currency) (domain.User, error) {
	var created domain.User
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		var err error
		created, err = r.insertUser(ctx, tx, u, base)
		return err
	})
	if err != nil {
		return domain.User{}, err
	}
	return created, nil
}

// CreateFirstUser creates u only while no user exists; the table lock makes the check and the
// insert one step for concurrent requests (W-U4).
func (r *Repository) CreateFirstUser(ctx context.Context, u domain.User, base money.Currency) (domain.User, error) {
	var created domain.User
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		if err := q.LockUsers(ctx); err != nil {
			return err
		}
		exists, err := q.AnyUser(ctx)
		if err != nil {
			return err
		}
		if exists {
			return app.ErrSetupComplete
		}
		created, err = r.insertUser(ctx, tx, u, base)
		return err
	})
	if err != nil {
		return domain.User{}, err
	}
	return created, nil
}

func (r *Repository) AnyUser(ctx context.Context) (bool, error) {
	return r.q.AnyUser(ctx)
}

func (r *Repository) insertUser(ctx context.Context, tx pgx.Tx, u domain.User, base money.Currency) (domain.User, error) {
	row, err := r.q.WithTx(tx).CreateUser(ctx, CreateUserParams{
		Email:        u.Email,
		PasswordHash: u.PasswordHash,
		Role:         string(u.Role),
		Language:     u.Language,
		Region:       u.Region,
	})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return domain.User{}, app.ErrEmailTaken
	}
	if err != nil {
		return domain.User{}, err
	}
	if err := outbox.Insert(ctx, tx, outbox.Event{
		Type:        userCreatedEvent,
		UserID:      row.ID,
		AggregateID: strconv.FormatInt(row.ID, 10),
		Payload:     userCreated{UserID: row.ID, Email: row.Email, Language: row.Language, Region: row.Region, BaseCurrency: base},
	}); err != nil {
		return domain.User{}, err
	}
	return toUser(row), nil
}

func (r *Repository) UpdateProfile(ctx context.Context, userID int64, l locale.Locale) (domain.User, error) {
	row, err := r.q.UpdateProfile(ctx, UpdateProfileParams{ID: userID, Language: l.Language, Region: l.Region})
	if err != nil {
		return domain.User{}, notFound(err)
	}
	return toUser(row), nil
}

func (r *Repository) UserByID(ctx context.Context, userID int64) (domain.User, error) {
	row, err := r.q.GetUserByID(ctx, userID)
	if err != nil {
		return domain.User{}, notFound(err)
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
		Language:     row.Language,
		Region:       row.Region,
		Disabled:     row.DisabledAt != nil,
	}
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}
	return err
}
