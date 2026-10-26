package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

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
			ID: l.ID, TransactionID: l.TransactionID, CardID: l.CardID, StatementID: l.StatementID, Amount: l.Amount,
			Credit: l.CardRole != nil && *l.CardRole == "credit", Statement: l.ReferenceMonth,
			Base: l.Base, PlanPurchase: l.PlanPurchaseDate, Anticipation: l.Anticipation,
		})
		txs = append(txs, l.TransactionID)
	}
	for _, p := range payments {
		f.Payments = append(f.Payments, app.CardPayment{
			ID: p.ID, TransactionID: p.TransactionID, CardID: p.CardID, Date: p.BookedOn, Amount: p.Amount, Financing: p.Financing,
		})
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

func (r *Repository) StatementCard(ctx context.Context, userID int64, id uuid.UUID) (uuid.UUID, error) {
	card, err := r.q.StatementCard(ctx, StatementCardParams{UserID: userID, ID: id})
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, app.ErrNotFound
	}
	return card, err
}

func (r *Repository) CardStatements(ctx context.Context, userID int64, cardID uuid.UUID) (string, []app.StatementRef, error) {
	instrument, err := r.q.CardInstrument(ctx, CardInstrumentParams{UserID: userID, ID: cardID})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, app.ErrNotFound
	}
	if err != nil {
		return "", nil, err
	}
	rows, err := r.q.AnalyticsStatements(ctx, AnalyticsStatementsParams{UserID: userID, CardID: cardID})
	if err != nil {
		return "", nil, err
	}
	out := make([]app.StatementRef, len(rows))
	for i, s := range rows {
		out[i] = app.StatementRef{ID: s.ID, CardID: s.AccountID, Reference: s.ReferenceMonth, Closing: s.ClosingDate, PreviousClosing: s.PreviousClosing}
	}
	return instrument, out, nil
}

func (r *Repository) ChargeCategories(ctx context.Context, userID int64) (map[uuid.UUID]bool, error) {
	ids, err := r.q.ChargeCategories(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out, nil
}
