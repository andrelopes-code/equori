package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

func (r *Repository) CardFacts(ctx context.Context, userID int64, to time.Time) (app.CardFacts, error) {
	lines, err := r.q.CashCardLines(ctx, userID)
	if err != nil {
		return app.CardFacts{}, err
	}
	payments, err := r.q.CashPayments(ctx, CashPaymentsParams{UserID: userID, ToDate: to})
	if err != nil {
		return app.CardFacts{}, err
	}
	f := app.CardFacts{Categories: map[uuid.UUID]app.Shares{}, Origins: map[uuid.UUID]uuid.UUID{}}
	var txs []uuid.UUID
	for _, l := range lines {
		f.Lines = append(f.Lines, app.CardLine{
			ID: l.ID, TransactionID: l.TransactionID, CardID: l.CardID, Amount: l.Amount,
			Credit: l.CardRole != nil && *l.CardRole == "credit", Statement: l.ReferenceMonth,
		})
		txs = append(txs, l.TransactionID)
	}
	for _, p := range payments {
		f.Payments = append(f.Payments, app.CardPayment{ID: p.ID, CardID: p.CardID, Date: p.BookedOn, Amount: p.Amount})
	}
	origins, err := r.q.CashOrigins(ctx, CashOriginsParams{UserID: userID, TransactionIds: txs})
	if err != nil {
		return app.CardFacts{}, err
	}
	for _, o := range origins {
		f.Origins[o.FromTransactionID] = o.ToTransactionID
		txs = append(txs, o.ToTransactionID)
	}
	postings, err := r.q.CashCategoryPostings(ctx, CashCategoryPostingsParams{UserID: userID, TransactionIds: txs})
	if err != nil {
		return app.CardFacts{}, err
	}
	for _, p := range postings {
		if f.Categories[p.TransactionID] == nil {
			f.Categories[p.TransactionID] = app.Shares{}
		}
		f.Categories[p.TransactionID][p.AccountID] += p.Amount
	}
	return f, nil
}

func (r *Repository) OffCardTotals(ctx context.Context, userID int64, from, to time.Time) (app.Shares, error) {
	rows, err := r.q.CashOffCardTotals(ctx, CashOffCardTotalsParams{UserID: userID, FromDate: from, ToDate: to})
	if err != nil {
		return nil, err
	}
	out := app.Shares{}
	for _, row := range rows {
		out[row.AccountID] = row.Total
	}
	return out, nil
}
