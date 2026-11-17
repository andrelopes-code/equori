package app

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ValuedBalance is BalanceAt valued in currency in with stored prices (P8 amendment
// A65); a parent whose sub-accounts hold several instruments sums their values.
func (s *Service) ValuedBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	basis Basis,
	in money.Currency,
) (Balance, Conversion, error) {
	if basis == "" {
		basis = BasisBooked
	}

	if _, err := money.ParseCurrency(string(in)); err != nil {
		return Balance{}, Conversion{}, fieldErr(
			"value_in",
			"must be a supported currency",
			domain.ErrValidation,
		)
	}

	if _, err := s.repo.Account(ctx, booksID, accountID); err != nil {
		return Balance{}, Conversion{}, err
	}

	totals, err := s.repo.TreeBalancesByInstrument(ctx, booksID, accountID, date, basis)
	if err != nil {
		return Balance{}, Conversion{}, err
	}

	out, amount, err := s.valueTotals(ctx, totals, in, date)
	if err != nil {
		return Balance{}, Conversion{}, err
	}

	b := Balance{AccountID: accountID, Date: date, Basis: basis, Amount: out.Value}
	if len(totals) == 1 {
		b.Amount = amount
	}

	return b, out, nil
}

// valueTotals sums the totals of each instrument valued in currency in at date.
func (s *Service) valueTotals(
	ctx context.Context,
	totals map[money.Currency]int64,
	in money.Currency,
	date time.Time,
) (Conversion, money.Money, error) {
	value, err := money.New(0, in)
	if err != nil {
		return Conversion{}, money.Money{}, err
	}

	out := Conversion{Value: value}
	convert := s.converter(ctx, totals, in, date)

	var amount money.Money
	for _, code := range slices.Sorted(maps.Keys(totals)) {
		if amount, err = s.AmountOf(ctx, totals[code], code); err != nil {
			return Conversion{}, money.Money{}, err
		}

		c := Conversion{Value: amount}
		if code != in {
			if amount.IsZero() {
				continue
			}

			c, err = convert(amount)
			if errors.Is(err, ErrPriceMissing) {
				return Conversion{}, money.Money{}, fieldErr(
					"value_in",
					err.Error(),
					ErrPriceMissing,
				)
			}

			if err != nil {
				return Conversion{}, money.Money{}, err
			}
		}

		if out.Value, err = out.Value.Add(c.Value); err != nil {
			return Conversion{}, money.Money{}, fmt.Errorf("sum valued balances: %w", err)
		}

		out.Prices = append(out.Prices, c.Prices...)
		if !amount.IsZero() {
			out.Parts = append(
				out.Parts,
				ValuedPart{Instrument: code, Quantity: amount, Value: c.Value},
			)
		}
	}

	return out, amount, nil
}

// converter returns how valueTotals converts an amount to in at date: at today of the book it
// asks for the current quotes of the totals once and takes them, at any other date it takes the
// closes (A248 CQ20).
func (s *Service) converter(
	ctx context.Context,
	totals map[money.Currency]int64,
	in money.Currency,
	date time.Time,
) func(money.Money) (Conversion, error) {
	if !date.Equal(s.Today(ctx)) {
		return func(q money.Money) (Conversion, error) {
			return s.prices.Convert(ctx, q, in, date)
		}
	}

	s.prices.WarmCurrent(ctx, append(slices.Collect(maps.Keys(totals)), in))

	return func(q money.Money) (Conversion, error) {
		return s.prices.ConvertCurrent(ctx, q, in)
	}
}
