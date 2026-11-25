package postgres

import (
	"context"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

// CreateMember publishes identity.books_created.v1 in the same transaction.
func (r *Repository) CreateMember(
	ctx context.Context,
	u domain.Member,
	region string,
	base money.Currency,
) (domain.Member, int64, error) {
	var (
		created domain.Member
		booksID int64
	)

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		var err error
		created, booksID, err = r.insertMember(
			ctx,
			tx,
			u,
			region,
			base,
			domain.DefaultBooksName(u.Email),
		)

		return err
	})
	if err != nil {
		return domain.Member{}, 0, err
	}

	return created, booksID, nil
}

// CreateFirstMember creates u only while no member exists; the table lock makes the check and the
// insert one step for concurrent requests (W-U4).
func (r *Repository) CreateFirstMember(
	ctx context.Context,
	u domain.Member,
	b app.FirstBooks,
) (domain.Member, int64, error) {
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

		created, booksID, err = r.insertMember(ctx, tx, u, b.Region, b.Base, b.Name)
		if err != nil {
			return err
		}

		if b.TimeZone == nil {
			return nil
		}

		_, err = q.UpdateBooksSettings(
			ctx,
			UpdateBooksSettingsParams{ID: booksID, Region: b.Region, TimeZone: b.TimeZone},
		)

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

func (r *Repository) insertMember(
	ctx context.Context,
	tx pgx.Tx,
	u domain.Member,
	region string,
	base money.Currency,
	name string,
) (domain.Member, int64, error) {
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

	booksID, err := r.insertBooks(ctx, tx, row.ID, row.Language, name, region, base)
	if err != nil {
		return domain.Member{}, 0, err
	}

	return toMember(row), booksID, nil
}

// insertBooks creates the book, the owner membership of memberID and the books_created event.
func (r *Repository) insertBooks(
	ctx context.Context,
	tx pgx.Tx,
	memberID int64,
	language, name, region string,
	base money.Currency,
) (int64, error) {
	q := r.q.WithTx(tx)

	booksID, err := q.CreateBooks(ctx, CreateBooksParams{Region: region, Name: name})
	if err != nil {
		return 0, err
	}

	if err := q.CreateMembership(
		ctx,
		CreateMembershipParams{MemberID: memberID, BooksID: booksID, Role: string(auth.RoleOwner)},
	); err != nil {
		return 0, err
	}

	if err := outbox.Insert(ctx, tx, outbox.Event{
		Type:        booksCreatedEvent,
		BooksID:     booksID,
		AggregateID: strconv.FormatInt(booksID, 10),
		Payload: booksCreated{
			BooksID:      booksID,
			MemberID:     memberID,
			Language:     language,
			Region:       region,
			BaseCurrency: base,
		},
	}); err != nil {
		return 0, err
	}

	return booksID, nil
}

func toMember(row IdentityMember) domain.Member {
	return domain.Member{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		Role:         domain.Role(row.Role),
		Language:     row.Language,
		DisplayName:  deref(row.DisplayName),
		BirthDate:    row.BirthDate,
		Disabled:     row.DisabledAt != nil,
	}
}
