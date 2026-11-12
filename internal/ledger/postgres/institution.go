package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (r *Repository) InsertInstitution(
	ctx context.Context,
	i app.Institution,
) (app.Institution, error) {
	row, err := r.q.InsertInstitution(
		ctx,
		InsertInstitutionParams{
			BooksID:          i.BooksID,
			Name:             i.Name,
			Code:             nullString(i.Code),
			IdentifierScheme: nullString(i.Identifier.Scheme),
			Identifier:       nullString(i.Identifier.Value),
		},
	)
	if err != nil {
		return app.Institution{}, duplicateInstitution(err)
	}

	return toInstitution(row), nil
}

func (r *Repository) SetInstitutionIdentifier(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	ident app.InstitutionIdentifier,
) (app.Institution, error) {
	row, err := r.q.SetInstitutionIdentifier(
		ctx,
		SetInstitutionIdentifierParams{
			BooksID:          booksID,
			ID:               id,
			IdentifierScheme: nullString(ident.Scheme),
			Identifier:       nullString(ident.Value),
		},
	)
	if err != nil {
		return app.Institution{}, duplicateInstitution(notFound(err))
	}

	return toInstitution(row), nil
}

func (r *Repository) DeleteInstitution(ctx context.Context, booksID int64, id uuid.UUID) error {
	n, err := r.q.DeleteInstitution(ctx, DeleteInstitutionParams{BooksID: booksID, ID: id})
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == foreignKeyViolation {
		return app.ErrInstitutionInUse
	}

	if err != nil {
		return err
	}

	if n == 0 {
		return app.ErrNotFound
	}

	return nil
}

func (r *Repository) ListInstitutions(
	ctx context.Context,
	booksID int64,
	p page.Request[app.InstitutionKey],
) ([]app.Institution, *app.InstitutionKey, error) {
	params := ListInstitutionsParams{BooksID: booksID, RowLimit: rowLimit(p.Limit)}
	if p.After != nil {
		params.AfterName, params.AfterID = &p.After.Name, nullUUID(p.After.ID)
	}

	rows, err := r.q.ListInstitutions(ctx, params)
	if err != nil {
		return nil, nil, err
	}

	items, next := pageOf(rows, p.Limit,
		func(row ListInstitutionsRow) app.Institution {
			return toInstitution(
				LedgerInstitution{
					ID:               row.ID,
					BooksID:          row.BooksID,
					Name:             row.Name,
					Code:             row.Code,
					IdentifierScheme: row.IdentifierScheme,
					Identifier:       row.Identifier,
				},
			)
		},
		func(row ListInstitutionsRow) app.InstitutionKey {
			return app.InstitutionKey{Name: row.SortName, ID: row.ID}
		})

	return items, next, nil
}

// duplicateInstitution names the field of the unique index an institution violated.
func duplicateInstitution(err error) error {
	if pgErr, ok := errors.AsType[*pgconn.PgError](
		err,
	); ok &&
		pgErr.ConstraintName == "ledger_institution_identifier_key" {
		return duplicate(err, "identifier")
	}

	return duplicate(err, "name")
}
