package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (r *Repository) complete(
	ctx context.Context,
	booksID int64,
	row LedgerTransaction,
) (domain.Transaction, error) {
	ts, err := r.completeAll(ctx, booksID, []LedgerTransaction{row})
	if err != nil {
		return domain.Transaction{}, err
	}

	return ts[0], nil
}

// completeAll loads postings, tags and links of rows in three queries.
func (r *Repository) completeAll(
	ctx context.Context,
	booksID int64,
	rows []LedgerTransaction,
) ([]domain.Transaction, error) {
	ids := make([]uuid.UUID, len(rows))
	byID := make(map[uuid.UUID]*domain.Transaction, len(rows))

	out := make([]domain.Transaction, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
		out[i] = toTransaction(row)
		byID[row.ID] = &out[i]
	}

	if err := r.attachPostings(ctx, booksID, ids, byID); err != nil {
		return nil, err
	}

	if err := r.attachTags(ctx, booksID, ids, byID); err != nil {
		return nil, err
	}

	if err := r.attachLinks(ctx, booksID, ids, byID); err != nil {
		return nil, err
	}

	if err := r.attachTrades(ctx, booksID, ids, byID); err != nil {
		return nil, err
	}

	if err := r.attachIncomes(ctx, booksID, ids, byID); err != nil {
		return nil, err
	}

	if err := r.attachCorporateActions(ctx, booksID, ids, byID); err != nil {
		return nil, err
	}

	return out, nil
}

func (r *Repository) attachPostings(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
	byID map[uuid.UUID]*domain.Transaction,
) error {
	postings, err := r.q.ListPostings(
		ctx,
		ListPostingsParams{BooksID: booksID, TransactionIds: ids},
	)
	if err != nil {
		return err
	}

	for _, p := range postings {
		posting, err := r.toPosting(ctx, p)
		if err != nil {
			return err
		}

		t := byID[p.TransactionID]
		t.Postings = append(t.Postings, posting)
	}

	return nil
}

func (r *Repository) attachTags(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
	byID map[uuid.UUID]*domain.Transaction,
) error {
	tags, err := r.q.ListTransactionTags(
		ctx,
		ListTransactionTagsParams{BooksID: booksID, TransactionIds: ids},
	)
	if err != nil {
		return err
	}

	for _, tag := range tags {
		t := byID[tag.TransactionID]
		t.Tags = append(t.Tags, tag.Name)
	}

	return nil
}

func (r *Repository) attachLinks(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
	byID map[uuid.UUID]*domain.Transaction,
) error {
	links, err := r.q.ListLinksFrom(ctx, ListLinksFromParams{BooksID: booksID, TransactionIds: ids})
	if err != nil {
		return err
	}

	for _, l := range links {
		t := byID[l.FromTransactionID]
		t.Links = append(
			t.Links,
			domain.Link{
				Type:   domain.LinkType(l.LinkType),
				Target: l.ToTransactionID,
				Amount: storedAmount(l.Amount),
			},
		)
	}

	return nil
}

func (r *Repository) attachTrades(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
	byID map[uuid.UUID]*domain.Transaction,
) error {
	trades, err := r.q.ListTrades(ctx, ListTradesParams{BooksID: booksID, TransactionIds: ids})
	if err != nil {
		return err
	}

	for _, row := range trades {
		trade, err := r.toTrade(ctx, row, byID[row.TransactionID])
		if err != nil {
			return err
		}

		byID[row.TransactionID].Trade = &trade
	}

	return nil
}

func (r *Repository) attachIncomes(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
	byID map[uuid.UUID]*domain.Transaction,
) error {
	incomes, err := r.q.ListInvestmentIncome(
		ctx,
		ListInvestmentIncomeParams{BooksID: booksID, TransactionIds: ids},
	)
	if err != nil {
		return err
	}

	for _, row := range incomes {
		cur := money.Currency(row.Currency)

		gross, err := money.New(row.Gross, cur)
		if err != nil {
			return err
		}

		withheld, err := money.New(row.Withheld, cur)
		if err != nil {
			return err
		}

		byID[row.TransactionID].Income = &domain.Income{
			AccountID:     row.AccountID,
			CashAccountID: row.CashAccountID,
			Type:          domain.IncomeType(row.IncomeType),
			Gross:         gross,
			Withheld:      withheld,
		}
	}

	return nil
}
