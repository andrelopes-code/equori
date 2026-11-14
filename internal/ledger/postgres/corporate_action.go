package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	platformpg "github.com/andrelopes-code/equori/internal/platform/postgres"
)

func (r *Repository) insertCorporateAction(ctx context.Context, t domain.Transaction) error {
	a := t.CorporateAction

	var unitCost pgtype.Numeric
	if a.UnitCost != nil {
		unitCost = platformpg.NumericOf(*a.UnitCost)
	}

	return r.q.InsertCorporateAction(ctx, InsertCorporateActionParams{
		TransactionID:     t.ID,
		BooksID:           t.BooksID,
		AccountID:         a.AccountID,
		Kind:              string(a.Kind),
		RatioFrom:         a.RatioFrom,
		RatioTo:           a.RatioTo,
		Held:              a.Held.Amount(),
		Received:          a.Received.Amount(),
		FractionRemainder: a.FractionRemainder,
		UnitCost:          unitCost,
		Value:             a.Value.Amount(),
	})
}

func (r *Repository) attachCorporateActions(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
	byID map[uuid.UUID]*domain.Transaction,
) error {
	rows, err := r.q.ListCorporateActions(
		ctx,
		ListCorporateActionsParams{BooksID: booksID, TransactionIds: ids},
	)
	if err != nil {
		return err
	}

	for _, row := range rows {
		action, err := r.toCorporateAction(ctx, row, byID[row.TransactionID])
		if err != nil {
			return err
		}

		byID[row.TransactionID].CorporateAction = &action
	}

	return nil
}

func (r *Repository) toCorporateAction(
	ctx context.Context,
	row LedgerCorporateAction,
	t *domain.Transaction,
) (domain.CorporateAction, error) {
	var instrument money.Currency
	for _, p := range t.Postings {
		if p.AccountID == row.AccountID {
			instrument = p.Amount.Currency()
		}
	}

	held, err := app.AmountOf(ctx, r.ins, row.Held, instrument)
	if err != nil {
		return domain.CorporateAction{}, fmt.Errorf("action %s held: %w", row.TransactionID, err)
	}

	received, err := app.AmountOf(ctx, r.ins, row.Received, instrument)
	if err != nil {
		return domain.CorporateAction{}, fmt.Errorf(
			"action %s received: %w",
			row.TransactionID,
			err,
		)
	}

	value, err := money.New(row.Value, t.BalancingCurrency)
	if err != nil {
		return domain.CorporateAction{}, err
	}

	action := domain.CorporateAction{
		AccountID:         row.AccountID,
		Kind:              domain.ActionKind(row.Kind),
		RatioFrom:         row.RatioFrom,
		RatioTo:           row.RatioTo,
		Held:              held,
		Received:          received,
		FractionRemainder: row.FractionRemainder,
		Value:             value,
	}
	if row.UnitCost.Valid {
		rate, err := platformpg.RateOf(row.UnitCost)
		if err != nil {
			return domain.CorporateAction{}, err
		}

		action.UnitCost = &rate
	}

	return action, nil
}
