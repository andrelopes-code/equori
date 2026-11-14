package postgres

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	platformpg "github.com/andrelopes-code/equori/internal/platform/postgres"
)

func (r *Repository) CountTransactions(ctx context.Context, booksID int64) (int64, error) {
	return r.q.CountTransactions(ctx, booksID)
}

func (r *Repository) Transaction(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Transaction, error) {
	row, err := r.q.GetTransaction(ctx, GetTransactionParams{BooksID: booksID, ID: id})
	if err != nil {
		return domain.Transaction{}, notFound(err)
	}

	return r.complete(ctx, booksID, row)
}

func (r *Repository) LockTransaction(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.Transaction, error) {
	row, err := r.q.GetTransactionForUpdate(
		ctx,
		GetTransactionForUpdateParams{BooksID: booksID, ID: id},
	)
	if err != nil {
		return domain.Transaction{}, notFound(err)
	}

	return r.complete(ctx, booksID, row)
}

func (r *Repository) InsertTransaction(
	ctx context.Context,
	t domain.Transaction,
) (domain.Transaction, error) {
	if err := r.InsertTransactionRows(ctx, t); err != nil {
		return domain.Transaction{}, err
	}

	return r.Transaction(ctx, t.BooksID, t.ID)
}

func (r *Repository) InsertTransactionRows(ctx context.Context, t domain.Transaction) error {
	//nolint:gosec // version is a small positive counter.
	_, err := r.q.InsertTransaction(ctx, InsertTransactionParams{
		ID:          t.ID,
		BooksID:     t.BooksID,
		Date:        t.Date,
		Description: t.Description,
		PayeeID:     nullUUID(t.PayeeID),
		BalancingCurrency: string(
			t.BalancingCurrency,
		),
		Origin:  string(t.Origin),
		Version: int32(t.Version),
	})
	if err != nil {
		return referenceError(err)
	}

	if err := r.writeChildren(ctx, t); err != nil {
		return err
	}

	if t.Income != nil {
		return r.insertIncome(ctx, t)
	}

	if t.Trade != nil {
		return r.insertTrade(ctx, t)
	}

	if t.CorporateAction != nil {
		return r.insertCorporateAction(ctx, t)
	}

	return nil
}

func (r *Repository) insertIncome(ctx context.Context, t domain.Transaction) error {
	in := t.Income

	return r.q.InsertInvestmentIncome(ctx, InsertInvestmentIncomeParams{
		TransactionID: t.ID,
		BooksID:       t.BooksID,
		AccountID:     in.AccountID,
		CashAccountID: in.CashAccountID,
		IncomeType:    string(in.Type),
		Gross:         in.Gross.Amount(),
		Withheld:      in.Withheld.Amount(),
		Currency:      string(in.Gross.Currency()),
	})
}

func (r *Repository) insertTrade(ctx context.Context, t domain.Transaction) error {
	tr := t.Trade

	var cost *int64
	if tr.Cost != nil {
		c := tr.Cost.Amount()
		cost = &c
	}

	return r.q.InsertTrade(ctx, InsertTradeParams{
		TransactionID:    t.ID,
		BooksID:          t.BooksID,
		AccountID:        tr.AccountID,
		CashAccountID:    tr.CashAccountID,
		Side:             string(tr.Side),
		Quantity:         tr.Quantity.Amount(),
		UnitPrice:        platformpg.NumericOf(tr.UnitPrice),
		Gross:            tr.Gross.Amount(),
		Fees:             tr.Fees.Amount(),
		Taxes:            tr.Taxes.Amount(),
		Cost:             cost,
		DayTradeQuantity: tr.DayTradeQuantity.Amount(),
		DayTradeCost:     tr.DayTradeCost.Amount(),
		Currency:         string(tr.Gross.Currency()),
	})
}

func (r *Repository) ListTransactions(
	ctx context.Context,
	q app.TransactionQuery,
) ([]domain.Transaction, error) {
	//nolint:gosec // limit is at most page.MaxLimit + 1.
	params := ListTransactionsParams{
		BooksID:   q.BooksID,
		AccountID: nullUUID(q.AccountID),
		PayeeID:   nullUUID(q.PayeeID),
		Tag:       nullString(q.Tag),
		Q: nullString(
			q.Q,
		),
		FromDate:      q.From,
		ToDate:        q.To,
		AmountMin:     q.AmountMin,
		AmountMax:     q.AmountMax,
		Uncategorized: q.Uncategorized,
		ExcludeVoided: q.ExcludeVoided,
		RowLimit:      int32(q.Limit),
	}
	if q.After != nil {
		params.AfterDate = &q.After.Date
		params.AfterID = nullUUID(q.After.ID)
	}

	rows, err := r.q.ListTransactions(ctx, params)
	if err != nil || len(rows) == 0 {
		return nil, err
	}

	return r.completeAll(ctx, q.BooksID, rows)
}

func (r *Repository) Versions(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) ([]app.Version, error) {
	rows, err := r.q.ListVersions(ctx, ListVersionsParams{BooksID: booksID, TransactionID: id})
	if err != nil {
		return nil, err
	}

	out := make([]app.Version, len(rows))
	for i, row := range rows {
		var s snapshot
		if err := json.Unmarshal(row.Snapshot, &s); err != nil {
			return nil, fmt.Errorf("decode version %d of %s: %w", row.Version, id, err)
		}

		t, err := s.transaction(ctx, r.ins)
		if err != nil {
			return nil, err
		}

		out[i] = app.Version{
			Version:     int(row.Version),
			Reason:      row.Reason,
			ReplacedAt:  row.ReplacedAt,
			Transaction: t,
		}
	}

	return out, nil
}

func (r *Repository) VoidTransaction(ctx context.Context, t domain.Transaction) error {
	return r.q.VoidTransaction(
		ctx,
		VoidTransactionParams{
			BooksID:    t.BooksID,
			ID:         t.ID,
			VoidedAt:   t.VoidedAt,
			VoidReason: nullString(t.VoidReason),
		},
	)
}

func (r *Repository) writeChildren(ctx context.Context, t domain.Transaction) error {
	if err := r.insertPostings(ctx, t, t.Postings, 0); err != nil {
		return err
	}

	if err := r.writeTags(ctx, t); err != nil {
		return err
	}

	for _, l := range t.Links {
		if err := r.q.InsertLink(
			ctx,
			InsertLinkParams{
				BooksID:           t.BooksID,
				FromTransactionID: t.ID,
				ToTransactionID:   l.Target,
				LinkType:          string(l.Type),
				Amount:            linkAmount(l.Amount),
			},
		); err != nil {
			return referenceError(err)
		}
	}

	return nil
}

// insertPostings writes ps of t at positions from first on.
func (r *Repository) insertPostings(
	ctx context.Context,
	t domain.Transaction,
	ps []domain.Posting,
	first int16,
) error {
	postings := make([]InsertPostingsParams, len(ps))
	for i, p := range ps {
		postings[i] = InsertPostingsParams{
			//nolint:gosec // at most 500 postings (domain.MaxPostings).
			BooksID:       t.BooksID,
			TransactionID: t.ID,
			AccountID:     p.AccountID,
			Position:      first + int16(i),
			Amount:        p.Amount.Amount(),
			Weight:        p.Weight.Amount(),
			BookedOn:      t.Date,
			SettledOn:     p.SettledOn,
			Status: string(
				p.Status,
			),
			OriginalAmount:     originalAmount(p.Original),
			OriginalInstrument: originalInstrument(p.Original),
			Memo: nullString(
				p.Memo,
			),
			StatementID:    nullUUID(p.StatementID),
			StatementBasis: cmp.Or(p.StatementBasis, domain.BasisDate),
			CardRole:       nullString(p.CardRole),
			InstallmentPlanID: installmentPlan(
				p.Installment,
			),
			InstallmentNumber: installmentNumber(p.Installment),
			InstallmentCount: installmentCount(
				p.Installment,
			),
			ExternalRecordID: nullUUID(p.ExternalRecordID),
		}
	}

	var postingErr error
	r.q.InsertPostings(ctx, postings).Exec(func(_ int, err error) {
		if err != nil && postingErr == nil {
			postingErr = err
		}
	})

	return referenceError(postingErr)
}

func (r *Repository) writeTags(ctx context.Context, t domain.Transaction) error {
	for _, tag := range t.Tags {
		tagID, err := r.q.UpsertTag(ctx, UpsertTagParams{BooksID: t.BooksID, Name: tag})
		if err != nil {
			return err
		}

		if err := r.q.InsertTransactionTag(
			ctx,
			InsertTransactionTagParams{BooksID: t.BooksID, TransactionID: t.ID, TagID: tagID},
		); err != nil {
			return err
		}
	}

	return nil
}
