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
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
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

	booksID, err := r.insertBooks(ctx, tx, row.ID, row.Language, domain.DefaultBooksName(u.Email), region, base)
	if err != nil {
		return domain.Member{}, 0, err
	}

	return toMember(row), booksID, nil
}

// insertBooks creates the book, the owner membership of memberID and the books_created event.
func (r *Repository) insertBooks(ctx context.Context, tx pgx.Tx, memberID int64, language, name, region string, base money.Currency) (int64, error) {
	q := r.q.WithTx(tx)

	booksID, err := q.CreateBooks(ctx, CreateBooksParams{Region: region, Name: name})
	if err != nil {
		return 0, err
	}

	if err := q.CreateMembership(ctx, CreateMembershipParams{MemberID: memberID, BooksID: booksID, Role: string(auth.RoleOwner)}); err != nil {
		return 0, err
	}

	if err := outbox.Insert(ctx, tx, outbox.Event{
		Type:        booksCreatedEvent,
		BooksID:     booksID,
		AggregateID: strconv.FormatInt(booksID, 10),
		Payload:     booksCreated{BooksID: booksID, MemberID: memberID, Language: language, Region: region, BaseCurrency: base},
	}); err != nil {
		return 0, err
	}

	return booksID, nil
}

// CreateBooks publishes identity.books_created.v1 in the same transaction.
func (r *Repository) CreateBooks(ctx context.Context, memberID int64, language, name, region string, base money.Currency) (int64, error) {
	var booksID int64

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		var err error
		booksID, err = r.insertBooks(ctx, tx, memberID, language, name, region, base)

		return err
	})
	if err != nil {
		return 0, err
	}

	return booksID, nil
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

func (r *Repository) BooksName(ctx context.Context, booksID int64) (string, error) {
	name, err := r.q.GetBooksName(ctx, booksID)
	if err != nil {
		return "", notFound(err)
	}

	return name, nil
}

func (r *Repository) UpdateBooksSettings(ctx context.Context, booksID int64, region string, timeZone, name *string) (string, error) {
	stored, err := r.q.UpdateBooksSettings(ctx, UpdateBooksSettingsParams{ID: booksID, Region: region, TimeZone: timeZone, Name: name})
	if err != nil {
		return "", notFound(err)
	}

	return stored, nil
}

func (r *Repository) TouchMembership(ctx context.Context, memberID, booksID int64, at time.Time) error {
	n, err := r.q.TouchMembership(ctx, TouchMembershipParams{MemberID: memberID, BooksID: booksID, LastActiveAt: at})
	if err != nil {
		return err
	}

	if n == 0 {
		return app.ErrNotFound
	}

	return nil
}

func (r *Repository) SwitchSession(ctx context.Context, tokenHash []byte, memberID, booksID int64, at time.Time) error {
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		n, err := q.TouchMembership(ctx, TouchMembershipParams{MemberID: memberID, BooksID: booksID, LastActiveAt: at})
		if err != nil {
			return err
		}

		if n == 0 {
			return app.ErrBooksNotFound
		}

		n, err = q.SwitchSession(ctx, SwitchSessionParams{TokenHash: tokenHash, MemberID: memberID, BooksID: booksID})
		if err != nil {
			return err
		}

		if n == 0 {
			return app.ErrUnauthenticated
		}

		return nil
	})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == foreignKeyViolation {
		return app.ErrBooksNotFound
	}

	return err
}

func (r *Repository) MemberBooks(ctx context.Context, memberID int64) ([]app.BooksMembership, error) {
	rows, err := r.q.ListMemberBooks(ctx, memberID)
	if err != nil {
		return nil, err
	}

	out := make([]app.BooksMembership, 0, len(rows))
	for _, row := range rows {
		out = append(out, app.BooksMembership{ID: row.ID, Name: row.Name, Role: auth.BookRole(row.Role)})
	}

	return out, nil
}

func (r *Repository) Members(ctx context.Context, booksID int64) ([]app.Membership, error) {
	rows, err := r.q.ListMembers(ctx, booksID)
	if err != nil {
		return nil, err
	}

	out := make([]app.Membership, 0, len(rows))
	for _, row := range rows {
		out = append(out, app.Membership{MemberID: row.MemberID, Email: row.Email, Role: auth.BookRole(row.Role), CreatedAt: row.CreatedAt})
	}

	return out, nil
}

func (r *Repository) ChangeRole(ctx context.Context, booksID, memberID int64, role auth.BookRole) error {
	return r.changeMembership(ctx, booksID, memberID, role != auth.RoleOwner, func(q *Queries) error {
		return q.UpdateMembershipRole(ctx, UpdateMembershipRoleParams{BooksID: booksID, MemberID: memberID, Role: string(role)})
	})
}

func (r *Repository) RemoveMembership(ctx context.Context, booksID, memberID int64) error {
	return r.changeMembership(ctx, booksID, memberID, true, func(q *Queries) error {
		return q.DeleteMembership(ctx, DeleteMembershipParams{BooksID: booksID, MemberID: memberID})
	})
}

// changeMembership runs apply under the lock of the book row (HA21); leaves is true when apply
// takes the owner role away from the membership, which then needs another owner.
func (r *Repository) changeMembership(ctx context.Context, booksID, memberID int64, leaves bool, apply func(*Queries) error) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		if err := q.LockBooks(ctx, booksID); err != nil {
			return err
		}

		stored, err := q.GetMembershipRole(ctx, GetMembershipRoleParams{BooksID: booksID, MemberID: memberID})
		if errors.Is(err, pgx.ErrNoRows) {
			return app.ErrMemberNotFound
		}

		if err != nil {
			return err
		}

		if auth.BookRole(stored) == auth.RoleOwner && leaves {
			others, err := q.CountOtherOwners(ctx, CountOtherOwnersParams{BooksID: booksID, MemberID: memberID})
			if err != nil {
				return err
			}

			if others == 0 {
				return app.ErrLastOwner
			}
		}

		return apply(q)
	})
}

func (r *Repository) Appearance(ctx context.Context, memberID int64) ([]byte, error) {
	doc, err := r.q.GetAppearance(ctx, memberID)
	if err != nil {
		return nil, notFound(err)
	}

	return doc, nil
}

func (r *Repository) SetAppearance(ctx context.Context, memberID int64, doc []byte) error {
	return r.q.SetAppearance(ctx, SetAppearanceParams{ID: memberID, Appearance: doc})
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

func (r *Repository) MemberBySession(ctx context.Context, tokenHash []byte, now time.Time) (app.Access, error) {
	row, err := r.q.GetMemberBySession(ctx, GetMemberBySessionParams{TokenHash: tokenHash, ExpiresAt: now})
	if err != nil {
		return app.Access{}, notFound(err)
	}

	user := toMember(IdentityMember{
		ID: row.ID, Email: row.Email, PasswordHash: row.PasswordHash, Role: row.Role,
		DisabledAt: row.DisabledAt, CreatedAt: row.CreatedAt, Language: row.Language,
	})

	return app.Access{Member: user, BooksID: row.BooksID, Role: auth.BookRole(row.BookRole)}, nil
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
