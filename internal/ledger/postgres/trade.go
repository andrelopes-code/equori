package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	platformpg "github.com/andrelopes-code/equori/internal/platform/postgres"
)

func (r *Repository) toTrade(
	ctx context.Context,
	row LedgerTrade,
	t *domain.Transaction,
) (domain.Trade, error) {
	instrument := postingInstrument(t, row.AccountID)

	quantity, err := app.AmountOf(ctx, r.ins, row.Quantity, instrument)
	if err != nil {
		return domain.Trade{}, fmt.Errorf("trade %s quantity: %w", row.TransactionID, err)
	}

	price, err := tradePrice(row.Side, row.UnitPrice)
	if err != nil {
		return domain.Trade{}, err
	}

	cur := money.Currency(row.Currency)

	amounts, err := tradeAmounts(row, cur)
	if err != nil {
		return domain.Trade{}, err
	}

	dayQuantity, err := app.AmountOf(ctx, r.ins, row.DayTradeQuantity, instrument)
	if err != nil {
		return domain.Trade{}, fmt.Errorf("trade %s day-trade quantity: %w", row.TransactionID, err)
	}

	dayCost, err := money.New(row.DayTradeCost, cur)
	if err != nil {
		return domain.Trade{}, err
	}

	cost, err := optionalMoney(row.Cost, cur)
	if err != nil {
		return domain.Trade{}, err
	}

	trade := domain.Trade{
		DayTradeQuantity: dayQuantity,
		Cost:             cost,
		DayTradeCost:     dayCost,
		AccountID:        row.AccountID,
		CashAccountID:    row.CashAccountID,
		Side:             domain.Side(row.Side),
		Quantity:         quantity,
		UnitPrice:        price,
		Gross:            amounts[0],
		Fees:             amounts[1],
		Taxes:            amounts[2],
	}

	trade.ExchangeRate, err = optionalRate(row.ExchangeRate)

	return trade, err
}

// tradePrice reads the unit price of a trade row; a write-off has none and stores zero (listed
// options design W3).
func tradePrice(side string, n pgtype.Numeric) (money.Rate, error) {
	if domain.Side(side) == domain.SideWriteOff {
		return money.Rate{}, nil
	}

	return platformpg.RateOf(n)
}

// postingInstrument returns the instrument of the posting of t on accountID.
func postingInstrument(t *domain.Transaction, accountID uuid.UUID) money.Currency {
	var instrument money.Currency
	for _, p := range t.Postings {
		if p.AccountID == accountID {
			instrument = p.Amount.Currency()
		}
	}

	return instrument
}

// tradeAmounts returns the gross, fees and taxes of row in cur.
func tradeAmounts(row LedgerTrade, cur money.Currency) ([]money.Money, error) {
	var err error

	amounts := make([]money.Money, 3)
	for i, v := range []int64{row.Gross, row.Fees, row.Taxes} {
		if amounts[i], err = money.New(v, cur); err != nil {
			return nil, err
		}
	}

	return amounts, nil
}

// optionalMoney returns nil for a nil v, else v in cur.
func optionalMoney(v *int64, cur money.Currency) (*money.Money, error) {
	if v == nil {
		return nil, nil
	}

	m, err := money.New(*v, cur)
	if err != nil {
		return nil, err
	}

	return &m, nil
}

// rateColumn returns the numeric of a nullable exchange rate.
func rateColumn(r *money.Rate) pgtype.Numeric {
	if r == nil {
		return pgtype.Numeric{}
	}

	return platformpg.NumericOf(*r)
}

// optionalRate returns nil for a null numeric, else its rate.
func optionalRate(n pgtype.Numeric) (*money.Rate, error) {
	if !n.Valid {
		return nil, nil
	}

	rate, err := platformpg.RateOf(n)
	if err != nil {
		return nil, err
	}

	return &rate, nil
}

func (r *Repository) FirstBuy(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) (uuid.UUID, bool, error) {
	id, err := r.q.FirstBuyOfAccount(
		ctx,
		FirstBuyOfAccountParams{BooksID: booksID, AccountID: accountID},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, nil
	}

	return id, err == nil, err
}
