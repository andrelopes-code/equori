package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const booksCreatedEvent = "identity.books_created.v1"

type booksCreated struct {
	BooksID      int64          `json:"books_id"`
	MemberID     int64          `json:"member_id"`
	Language     string         `json:"language"`
	Region       string         `json:"region"`
	BaseCurrency money.Currency `json:"base_currency"`
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

// DeleteBooks runs the checks of DB2 to DB4 under the lock of the book row, then deletes the row
// with the constraints deferred to the commit, so the cascade empties tables that reference each other.
func (r *Repository) DeleteBooks(ctx context.Context, booksID, memberID int64, name string) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		if err := q.LockBooks(ctx, booksID); err != nil {
			return err
		}

		stored, err := q.GetBooksName(ctx, booksID)
		if err != nil {
			return notFound(err)
		}

		if stored != name {
			return app.ErrConfirmationMismatch
		}

		members, err := q.CountBooksMembers(ctx, booksID)
		if err != nil {
			return err
		}

		if members > 1 {
			return app.ErrBooksHasMembers
		}

		books, err := q.CountMemberBooks(ctx, memberID)
		if err != nil {
			return err
		}

		if books < 2 {
			return app.ErrLastBooks
		}

		if _, err := tx.Exec(ctx, `SET CONSTRAINTS ALL DEFERRED`); err != nil {
			return err
		}

		// The cascade deletes reconciled postings, which ledger_protect_reconciled refuses
		// unless the transaction unlocks them.
		if _, err := tx.Exec(ctx, `SELECT set_config('equori.unlock_reconciled', 'on', TRUE)`); err != nil {
			return err
		}

		return q.DeleteBooks(ctx, booksID)
	})
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
