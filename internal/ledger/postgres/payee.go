package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (r *Repository) InsertPayee(ctx context.Context, p app.Payee) (app.Payee, error) {
	row, err := r.q.InsertPayee(ctx, InsertPayeeParams{BooksID: p.BooksID, Name: p.Name})
	if err != nil {
		return app.Payee{}, duplicate(err, "name")
	}

	return toPayee(row), nil
}

func (r *Repository) RenamePayee(ctx context.Context, booksID int64, id uuid.UUID, name string) (app.Payee, error) {
	row, err := r.q.RenamePayee(ctx, RenamePayeeParams{BooksID: booksID, ID: id, Name: name})
	if err != nil {
		return app.Payee{}, duplicate(notFound(err), "name")
	}

	return toPayee(row), nil
}

func (r *Repository) TransactionsWithPayee(ctx context.Context, booksID int64, payeeID uuid.UUID) ([]uuid.UUID, error) {
	return r.q.TransactionsWithPayee(ctx, TransactionsWithPayeeParams{BooksID: booksID, PayeeID: nullUUID(payeeID)})
}

func (r *Repository) RetirePayee(ctx context.Context, booksID int64, from, into uuid.UUID) error {
	if err := r.q.MoveVoidedPayee(ctx, MoveVoidedPayeeParams{BooksID: booksID, FromID: nullUUID(from), IntoID: nullUUID(into)}); err != nil {
		return err
	}

	if err := r.q.MoveCounterpartyPayee(ctx, MoveCounterpartyPayeeParams{BooksID: booksID, FromID: nullUUID(from), IntoID: nullUUID(into)}); err != nil {
		return err
	}

	return r.q.MarkPayeeMerged(ctx, MarkPayeeMergedParams{BooksID: booksID, FromID: from, IntoID: nullUUID(into)})
}

func (r *Repository) Payee(ctx context.Context, booksID int64, id uuid.UUID) (app.Payee, error) {
	row, err := r.q.GetPayee(ctx, GetPayeeParams{BooksID: booksID, ID: id})
	if err != nil {
		return app.Payee{}, notFound(err)
	}

	return toPayee(row), nil
}

func (r *Repository) PayeeNames(ctx context.Context, booksID int64, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	rows, err := r.q.PayeeNames(ctx, PayeeNamesParams{BooksID: booksID, Ids: ids})
	if err != nil {
		return nil, err
	}

	out := make(map[uuid.UUID]string, len(rows))
	for _, row := range rows {
		out[row.ID] = row.Name
	}

	return out, nil
}

func (r *Repository) ListPayees(ctx context.Context, booksID int64, p page.Request[app.PayeeKey]) ([]app.Payee, *app.PayeeKey, error) {
	params := ListPayeesParams{BooksID: booksID, RowLimit: rowLimit(p.Limit)}
	if p.After != nil {
		params.AfterName, params.AfterID = &p.After.Name, nullUUID(p.After.ID)
	}

	rows, err := r.q.ListPayees(ctx, params)
	if err != nil {
		return nil, nil, err
	}

	items, next := pageOf(rows, p.Limit,
		func(row ListPayeesRow) app.Payee {
			return toPayee(LedgerPayee{ID: row.ID, BooksID: row.BooksID, Name: row.Name})
		},
		func(row ListPayeesRow) app.PayeeKey { return app.PayeeKey{Name: row.SortName, ID: row.ID} })

	return items, next, nil
}
