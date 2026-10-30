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

// CreateMember publishes identity.books_created.v1 in the same transaction.
func (r *Repository) CreateMember(ctx context.Context, u domain.Member, region string, base money.Currency) (domain.Member, int64, error) {
	var (
		created domain.Member
		booksID int64
	)

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		var err error
		created, booksID, err = r.insertMember(ctx, tx, u, region, base)

		return err
	})
	if err != nil {
		return domain.Member{}, 0, err
	}

	return created, booksID, nil
}

// CreateFirstMember creates u only while no member exists; the table lock makes the check and the
// insert one step for concurrent requests (W-U4).
func (r *Repository) CreateFirstMember(ctx context.Context, u domain.Member, region string, base money.Currency) (domain.Member, int64, error) {
	var (
		created domain.Member
		booksID int64
	)

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		if err := q.LockMembers(ctx); err != nil {
			return err
		}

		exists, err := q.AnyMember(ctx)
		if err != nil {
			return err
		}

		if exists {
			return app.ErrSetupComplete
		}

		created, booksID, err = r.insertMember(ctx, tx, u, region, base)

		return err
	})
	if err != nil {
		return domain.Member{}, 0, err
	}

	return created, booksID, nil
}

func (r *Repository) AnyMember(ctx context.Context) (bool, error) {
	return r.q.AnyMember(ctx)
}

func (r *Repository) insertMember(ctx context.Context, tx pgx.Tx, u domain.Member, region string, base money.Currency) (domain.Member, int64, error) {
	q := r.q.WithTx(tx)

	row, err := q.CreateMember(ctx, CreateMemberParams{
		Email:        u.Email,
		PasswordHash: u.PasswordHash,
		Role:         string(u.Role),
		Language:     u.Language,
	})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
		return domain.Member{}, 0, app.ErrEmailTaken
	}

	if err != nil {
		return domain.Member{}, 0, err
	}

	booksID, err := q.CreateBooks(ctx, region)
	if err != nil {
		return domain.Member{}, 0, err
	}

	if err := q.CreateMembership(ctx, CreateMembershipParams{MemberID: row.ID, BooksID: booksID, Role: "owner"}); err != nil {
		return domain.Member{}, 0, err
	}

	if err := outbox.Insert(ctx, tx, outbox.Event{
		Type:        booksCreatedEvent,
		BooksID:     booksID,
		AggregateID: strconv.FormatInt(booksID, 10),
		Payload:     booksCreated{BooksID: booksID, MemberID: row.ID, Language: row.Language, Region: region, BaseCurrency: base},
	}); err != nil {
		return domain.Member{}, 0, err
	}

	return toMember(row), booksID, nil
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

func (r *Repository) BooksZone(ctx context.Context, booksID int64) (string, *string, error) {
	row, err := r.q.GetBooksZone(ctx, booksID)
	if err != nil {
		return "", nil, notFound(err)
	}

	return row.Region, row.TimeZone, nil
}

func (r *Repository) UpdateBooksSettings(ctx context.Context, booksID int64, region string, timeZone *string) error {
	return r.q.UpdateBooksSettings(ctx, UpdateBooksSettingsParams{ID: booksID, Region: region, TimeZone: timeZone})
}

func (r *Repository) LoginBooks(ctx context.Context, memberID int64) (int64, error) {
	booksID, err := r.q.GetLoginBooks(ctx, memberID)
	if err != nil {
		return 0, notFound(err)
	}

	return booksID, nil
}

func (r *Repository) MemberByID(ctx context.Context, memberID int64) (domain.Member, error) {
	row, err := r.q.GetMemberByID(ctx, memberID)
	if err != nil {
		return domain.Member{}, notFound(err)
	}

	return toMember(row), nil
}

func (r *Repository) MemberByEmail(ctx context.Context, email string) (domain.Member, error) {
	row, err := r.q.GetMemberByEmail(ctx, email)
	if err != nil {
		return domain.Member{}, notFound(err)
	}

	return toMember(row), nil
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

func (r *Repository) MemberBySession(ctx context.Context, tokenHash []byte, now time.Time) (domain.Member, int64, error) {
	row, err := r.q.GetMemberBySession(ctx, GetMemberBySessionParams{TokenHash: tokenHash, ExpiresAt: now})
	if err != nil {
		return domain.Member{}, 0, notFound(err)
	}

	user := toMember(IdentityMember{
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

func toMember(row IdentityMember) domain.Member {
	return domain.Member{
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
