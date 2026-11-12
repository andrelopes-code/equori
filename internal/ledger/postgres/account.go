package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (r *Repository) Account(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Account, error) {
	row, err := r.q.GetAccount(ctx, GetAccountParams{BooksID: booksID, ID: id})
	if err != nil {
		return domain.Account{}, notFound(err)
	}

	return toAccount(row), nil
}

func (r *Repository) Accounts(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
) (map[uuid.UUID]domain.Account, error) {
	rows, err := r.q.GetAccountsByIDs(ctx, GetAccountsByIDsParams{BooksID: booksID, Ids: ids})
	if err != nil {
		return nil, err
	}

	out := make(map[uuid.UUID]domain.Account, len(rows))
	for _, row := range rows {
		out[row.ID] = toAccount(row)
	}

	return out, nil
}

func (r *Repository) ListAccounts(
	ctx context.Context,
	booksID int64,
	p page.Request[app.AccountKey],
) ([]domain.Account, *app.AccountKey, error) {
	params := ListAccountsParams{BooksID: booksID, RowLimit: rowLimit(p.Limit)}
	if p.After != nil {
		params.AfterClass, params.AfterName, params.AfterID = &p.After.Class, &p.After.Name, nullUUID(
			p.After.ID,
		)
	}

	rows, err := r.q.ListAccounts(ctx, params)
	if err != nil {
		return nil, nil, err
	}

	items, next := pageOf(rows, p.Limit,
		func(row ListAccountsRow) domain.Account {
			return toAccount(LedgerAccount{
				ID:                    row.ID,
				BooksID:               row.BooksID,
				Name:                  row.Name,
				AccountClass:          row.AccountClass,
				Kind:                  row.Kind,
				Instrument:            row.Instrument,
				ParentID:              row.ParentID,
				InstitutionID:         row.InstitutionID,
				CounterpartyPayeeID:   row.CounterpartyPayeeID,
				OpenedOn:              row.OpenedOn,
				ClosedOn:              row.ClosedOn,
				YieldMode:             row.YieldMode,
				SystemRole:            row.SystemRole,
				Color:                 row.Color,
				Icon:                  row.Icon,
				ExcludedFromLiquidity: row.ExcludedFromLiquidity,
				CreatedAt:             row.CreatedAt,
				UpdatedAt:             row.UpdatedAt,
			})
		},
		func(row ListAccountsRow) app.AccountKey {
			return app.AccountKey{Class: row.AccountClass, Name: row.SortName, ID: row.ID}
		})

	return items, next, nil
}

func (r *Repository) InsertAccount(ctx context.Context, a domain.Account) (domain.Account, error) {
	row, err := r.q.InsertAccount(ctx, InsertAccountParams{
		BooksID:      a.BooksID,
		Name:         a.Name,
		AccountClass: string(a.Class),
		Kind:         nullString(string(a.Kind)),
		Instrument: string(
			a.Instrument,
		),
		ParentID:            nullUUID(a.ParentID),
		InstitutionID:       nullUUID(a.InstitutionID),
		CounterpartyPayeeID: nullUUID(a.CounterpartyID),
		OpenedOn:            a.OpenedOn,
		ClosedOn:            a.ClosedOn,
		YieldMode:           string(a.YieldMode),
		SystemRole:          nullString(string(a.SystemRole)),
		Color:               nullColor(a.Color),
		Icon:                nullString(a.Icon),
	})
	if err != nil {
		return domain.Account{}, referenceError(err)
	}

	return toAccount(row), nil
}

func (r *Repository) UpdateAccount(ctx context.Context, a domain.Account) (domain.Account, error) {
	row, err := r.q.UpdateAccount(ctx, UpdateAccountParams{
		BooksID:  a.BooksID,
		ID:       a.ID,
		Name:     a.Name,
		ParentID: nullUUID(a.ParentID),
		OpenedOn: a.OpenedOn,
		InstitutionID: nullUUID(
			a.InstitutionID,
		),
		ClosedOn:  a.ClosedOn,
		YieldMode: string(a.YieldMode),
		Color: nullColor(
			a.Color,
		),
		Icon:                  nullString(a.Icon),
		ExcludedFromLiquidity: a.ExcludedFromLiquidity,
	})
	if err != nil {
		return domain.Account{}, referenceError(notFound(err))
	}

	return toAccount(row), nil
}

func (r *Repository) AccountHasChildren(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (bool, error) {
	return r.q.AccountHasChildren(
		ctx,
		AccountHasChildrenParams{BooksID: booksID, ParentID: nullUUID(id)},
	)
}

func (r *Repository) ChildAccounts(
	ctx context.Context,
	booksID int64,
	parentID uuid.UUID,
) ([]domain.Account, error) {
	rows, err := r.q.ListChildAccounts(
		ctx,
		ListChildAccountsParams{BooksID: booksID, ParentID: nullUUID(parentID)},
	)
	if err != nil {
		return nil, err
	}

	return mapAll(rows, toAccount), nil
}

func (r *Repository) InstitutionAccounts(
	ctx context.Context,
	booksID int64,
	institutionID uuid.UUID,
) ([]domain.Account, error) {
	rows, err := r.q.ListInstitutionAccounts(
		ctx,
		ListInstitutionAccountsParams{BooksID: booksID, InstitutionID: nullUUID(institutionID)},
	)
	if err != nil {
		return nil, err
	}

	return mapAll(rows, toAccount), nil
}

func (r *Repository) AccountTotals(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (app.AccountTotals, error) {
	row, err := r.q.AccountTotals(ctx, AccountTotalsParams{BooksID: booksID, AccountID: id})
	if err != nil {
		return app.AccountTotals{}, err
	}

	return app.AccountTotals{Total: row.Total, LastBookedOn: row.LastBookedOn}, nil
}

func (r *Repository) AccountTransactionsBetween(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
) ([]uuid.UUID, error) {
	return r.q.AccountTransactionsBetween(
		ctx,
		AccountTransactionsBetweenParams{
			BooksID:   booksID,
			AccountID: accountID,
			FromDate:  from,
			ToDate:    to,
		},
	)
}

func (r *Repository) TransactionsWithAccount(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) ([]uuid.UUID, error) {
	return r.q.TransactionsWithAccount(
		ctx,
		TransactionsWithAccountParams{BooksID: booksID, AccountID: accountID},
	)
}

func (r *Repository) SystemAccount(
	ctx context.Context,
	booksID int64,
	role domain.SystemRole,
) (domain.Account, error) {
	row, err := r.q.GetSystemAccount(
		ctx,
		GetSystemAccountParams{BooksID: booksID, SystemRole: nullString(string(role))},
	)
	if err != nil {
		return domain.Account{}, notFound(err)
	}

	return toAccount(row), nil
}
