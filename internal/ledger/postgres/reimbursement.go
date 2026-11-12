package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

func (r *Repository) RefundedTotal(
	ctx context.Context,
	booksID int64,
	originID uuid.UUID,
) (int64, error) {
	return r.q.RefundedTotal(ctx, RefundedTotalParams{BooksID: booksID, ToTransactionID: originID})
}

func (r *Repository) ReimbursedTotal(
	ctx context.Context,
	booksID int64,
	originID, exceptFrom uuid.UUID,
) (int64, error) {
	return r.q.ReimbursedTotal(
		ctx,
		ReimbursedTotalParams{BooksID: booksID, OriginID: originID, ExceptFrom: exceptFrom},
	)
}

func (r *Repository) ReimbursementCandidates(
	ctx context.Context,
	q app.CandidateQuery,
) ([]app.CandidateRow, error) {
	rows, err := r.q.ListReimbursementCandidates(ctx, ListReimbursementCandidatesParams{
		Instrument: string(
			q.Instrument,
		),
		BooksID:       q.BooksID,
		TransactionID: q.ExcludeID,
		FromDate:      q.From,
		ToDate:        q.To,
		Amount:        q.Amount,
		MaxRows:       int32(q.MaxRows), //nolint:gosec // the limit is a small constant.
	})
	if err != nil {
		return nil, err
	}

	out := make([]app.CandidateRow, len(rows))
	for i, row := range rows {
		out[i] = app.CandidateRow{ID: row.ID, Remaining: row.Remaining, Allocated: row.Allocated}
	}

	return out, nil
}

func (r *Repository) ReimbursementSources(
	ctx context.Context,
	q app.SourceQuery,
) ([]app.SourceRow, error) {
	rows, err := r.q.ListReimbursementSources(ctx, ListReimbursementSourcesParams{
		Instrument: string(
			q.Instrument,
		),
		BooksID:       q.BooksID,
		TransactionID: q.ExcludeID,
		FromDate:      q.From,
		ToDate:        q.To,
		MaxRows:       int32(q.MaxRows), //nolint:gosec // the limit is a small constant.
	})
	if err != nil {
		return nil, err
	}

	out := make([]app.SourceRow, len(rows))
	for i, row := range rows {
		out[i] = app.SourceRow{ID: row.ID, Free: row.Free}
	}

	return out, nil
}

func (r *Repository) SetReimbursementLinks(
	ctx context.Context,
	booksID int64,
	from uuid.UUID,
	links []domain.Link,
) error {
	if err := r.q.DeleteReimbursementLinksFrom(
		ctx,
		DeleteReimbursementLinksFromParams{BooksID: booksID, FromTransactionID: from},
	); err != nil {
		return err
	}

	for _, l := range links {
		err := r.q.InsertLink(
			ctx,
			InsertLinkParams{
				BooksID:           booksID,
				FromTransactionID: from,
				ToTransactionID:   l.Target,
				LinkType:          string(l.Type),
				Amount:            linkAmount(l.Amount),
			},
		)
		if err != nil {
			return referenceError(err)
		}
	}

	return nil
}
