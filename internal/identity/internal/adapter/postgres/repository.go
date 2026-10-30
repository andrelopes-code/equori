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

const booksCreatedEvent = "identity.books_created.v1"

type booksCreated struct {
	BooksID      int64          `json:"books_id"`
	MemberID     int64          `json:"member_id"`
	Language     string         `json:"language"`
	Region       string         `json:"region"`
	BaseCurrency money.Currency `json:"base_currency"`
}

// CreateUser publishes identity.books_created.v1 in the same transaction.
func (r *Repository) CreateUser(ctx context.Context, u domain.User, region string, base money.Currency) (domain.User, int64, error) {
	var (
		created domain.User
		booksID int64
	)

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		var err error
		created, booksID, err = r.insertUser(ctx, tx, u, region, base)

		return err
	})
	if err != nil {
		return domain.User{}, 0, err
	}

	return created, booksID, nil
}

// CreateFirstUser creates u only while no user exists; the table lock makes the check and the
// insert one step for concurrent requests (W-U4).
func (r *Repository) CreateFirstUser(ctx context.Context, u domain.User, region string, base money.Currency) (domain.User, int64, error) {
	var (
		created domain.User
		booksID int64
	)

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

		created, booksID, err = r.insertUser(ctx, tx, u, region, base)

		return err
	})
	if err != nil {
		return domain.User{}, 0, err
	}

	return created, booksID, nil
}

func (r *Repository) AnyUser(ctx context.Context) (bool, error) {
	return r.q.AnyUser(ctx)
}

func (r *Repository) insertUser(ctx context.Context, tx pgx.Tx, u domain.User, region string, base money.Currency) (domain.User, int64, error) {
	q := r.q.WithTx(tx)

	row, err := q.CreateMember(ctx, CreateMemberParams{
		Email:        u.Email,
		PasswordHash: u.PasswordHash,
		Role:         string(u.Role),
		Language:     u.Language,
	})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return domain.User{}, 0, app.ErrEmailTaken
	}

	if err != nil {
		return domain.User{}, 0, err
	}

	booksID, err := q.CreateBooks(ctx, region)
	if err != nil {
		return domain.User{}, 0, err
	}

	if err := q.CreateMembership(ctx, CreateMembershipParams{MemberID: row.ID, BooksID: booksID, Role: "owner"}); err != nil {
		return domain.User{}, 0, err
	}

	if err := outbox.Insert(ctx, tx, outbox.Event{
		Type:        booksCreatedEvent,
		BooksID:     booksID,
		AggregateID: strconv.FormatInt(booksID, 10),
		Payload:     booksCreated{BooksID: booksID, MemberID: row.ID, Language: row.Language, Region: region, BaseCurrency: base},
	}); err != nil {
		return domain.User{}, 0, err
	}

	return toUser(row), booksID, nil
}

// UpdateProfile stores the language of the member and the region of the books in one transaction.
func (r *Repository) UpdateProfile(ctx context.Context, memberID, booksID int64, l locale.Locale) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		if err := q.UpdateLanguage(ctx, UpdateLanguageParams{ID: memberID, Language: l.Language}); err != nil {
			return err
		}

		return q.UpdateRegion(ctx, UpdateRegionParams{ID: booksID, Region: l.Region})
	})
}

func (r *Repository) Locale(ctx context.Context, booksID, memberID int64) (locale.Locale, error) {
	row, err := r.q.GetLocale(ctx, GetLocaleParams{BooksID: booksID, MemberID: memberID})
	if err != nil {
		return locale.Locale{}, notFound(err)
	}

	return locale.Locale{Language: row.Language, Region: row.Region}, nil
}

func (r *Repository) LoginBooks(ctx context.Context, memberID int64) (int64, error) {
	booksID, err := r.q.GetLoginBooks(ctx, memberID)
	if err != nil {
		return 0, notFound(err)
	}

	return booksID, nil
}

func (r *Repository) UserByID(ctx context.Context, memberID int64) (domain.User, error) {
	row, err := r.q.GetUserByID(ctx, memberID)
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
		MemberID:  s.MemberID,
		BooksID:   s.BooksID,
		CreatedAt: s.CreatedAt,
		ExpiresAt: s.ExpiresAt,
	})
}

func (r *Repository) UserBySession(ctx context.Context, tokenHash []byte, now time.Time) (domain.User, int64, error) {
	row, err := r.q.GetUserBySession(ctx, GetUserBySessionParams{TokenHash: tokenHash, ExpiresAt: now})
	if err != nil {
		return domain.User{}, 0, notFound(err)
	}

	user := toUser(IdentityMember{
		ID: row.ID, Email: row.Email, PasswordHash: row.PasswordHash, Role: row.Role,
		DisabledAt: row.DisabledAt, CreatedAt: row.CreatedAt, Language: row.Language,
	})

	return user, row.BooksID, nil
}

func (r *Repository) DeleteSession(ctx context.Context, tokenHash []byte) error {
	return r.q.DeleteSession(ctx, tokenHash)
}

func (r *Repository) DeleteExpiredSessions(ctx context.Context, now time.Time) error {
	return r.q.DeleteExpiredSessions(ctx, now)
}

func toUser(row IdentityMember) domain.User {
	return domain.User{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		Role:         domain.Role(row.Role),
		Language:     row.Language,
		Disabled:     row.DisabledAt != nil,
	}
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return app.ErrNotFound
	}

	return err
}
