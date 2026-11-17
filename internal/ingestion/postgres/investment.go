package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (r *Repository) StoreInvestments(
	ctx context.Context,
	booksID int64,
	connectionID uuid.UUID,
	invs []domain.ExternalInvestment,
) error {
	return pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		for _, inv := range invs {
			id, err := q.UpsertExternalInvestment(ctx, upsertParams(booksID, connectionID, inv))
			if err != nil {
				return fmt.Errorf("store investment: %w", err)
			}

			for _, m := range inv.Movements {
				if err := q.InsertInvestmentMovement(ctx, InsertInvestmentMovementParams{
					BooksID:      booksID,
					InvestmentID: id,
					ExternalID:   m.ID,
					Kind:         m.Kind,
					MovedOn:      m.Date,
					Quantity:     m.Quantity,
					Amount:       m.Amount.Amount(),
				}); err != nil {
					return fmt.Errorf("store investment movement: %w", err)
				}
			}
		}

		return nil
	})
}

func (r *Repository) ConnectionInvestments(
	ctx context.Context,
	booksID int64,
	connectionID uuid.UUID,
) ([]domain.StoredInvestment, error) {
	rows, err := r.q.ListConnectionInvestments(
		ctx,
		ListConnectionInvestmentsParams{BooksID: booksID, ConnectionID: connectionID},
	)
	if err != nil {
		return nil, fmt.Errorf("list investments: %w", err)
	}

	ids := make([]uuid.UUID, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}

	moves, err := r.q.ListInvestmentMovements(
		ctx,
		ListInvestmentMovementsParams{BooksID: booksID, InvestmentIds: ids},
	)
	if err != nil {
		return nil, fmt.Errorf("list investment movements: %w", err)
	}

	out := make([]domain.StoredInvestment, len(rows))
	index := make(map[uuid.UUID]int, len(rows))

	for i, row := range rows {
		out[i] = toStoredInvestment(row)
		index[row.ID] = i
	}

	for _, m := range moves {
		i := index[m.InvestmentID]
		out[i].Movements = append(out[i].Movements, toStoredMovement(m, out[i].Source.Balance))
	}

	return out, nil
}

func upsertParams(
	booksID int64,
	connectionID uuid.UUID,
	inv domain.ExternalInvestment,
) UpsertExternalInvestmentParams {
	return UpsertExternalInvestmentParams{
		BooksID:          booksID,
		ConnectionID:     connectionID,
		ExternalID:       inv.ID,
		Type:             inv.Type,
		Subtype:          inv.Subtype,
		Name:             inv.Name,
		Issuer:           inv.Issuer,
		IssuerScheme:     inv.IssuerScheme,
		IssuerID:         inv.IssuerID,
		IndexID:          inv.IndexID,
		PercentOfIndexBp: int32(inv.PercentOfIndexBP), //nolint:gosec // basis points of a rate
		SpreadBp:         int32(inv.SpreadBP),         //nolint:gosec // basis points of a rate
		HasTerms:         inv.HasTerms,
		IssuedOn:         inv.IssuedOn,
		MaturesOn:        inv.MaturesOn,
		Quantity:         inv.Quantity,
		Balance:          inv.Balance.Amount(),
		Currency:         string(inv.Balance.Currency()),
		BalanceDate:      inv.BalanceDate,
	}
}

func toStoredInvestment(row IngestionExternalInvestment) domain.StoredInvestment {
	// The currency was valid when stored, so the amount cannot fail to build.
	balance, _ := money.New(row.Balance, money.Currency(row.Currency))

	return domain.StoredInvestment{
		ID:           row.ID,
		ConnectionID: row.ConnectionID,
		Source: domain.ExternalInvestment{
			ID:               row.ExternalID,
			Type:             row.Type,
			Subtype:          row.Subtype,
			Name:             row.Name,
			Issuer:           row.Issuer,
			IssuerScheme:     row.IssuerScheme,
			IssuerID:         row.IssuerID,
			IndexID:          row.IndexID,
			PercentOfIndexBP: int(row.PercentOfIndexBp),
			SpreadBP:         int(row.SpreadBp),
			HasTerms:         row.HasTerms,
			IssuedOn:         row.IssuedOn,
			MaturesOn:        row.MaturesOn,
			Quantity:         row.Quantity,
			Balance:          balance,
			BalanceDate:      row.BalanceDate,
		},
		BrokerageID: uuidPtr(row.BrokerageID),
		AccountID:   uuidPtr(row.AccountID),
		Instrument:  row.Instrument,
	}
}

// toStoredMovement gives the movement the currency of its investment's balance.
func toStoredMovement(row IngestionInvestmentMovement, balance money.Money) domain.StoredMovement {
	amount, _ := money.New(row.Amount, balance.Currency())

	return domain.StoredMovement{
		ID:            row.ID,
		ExternalID:    row.ExternalID,
		Kind:          row.Kind,
		Date:          row.MovedOn,
		Amount:        amount,
		State:         row.State,
		TransactionID: uuidPtr(row.TransactionID),
		ApplicationID: row.ApplicationID,
	}
}

func uuidPtr(id uuid.NullUUID) *uuid.UUID {
	if !id.Valid {
		return nil
	}

	return &id.UUID
}
