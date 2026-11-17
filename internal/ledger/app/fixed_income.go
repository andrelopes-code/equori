package app

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	fixedIncomeType = "fixed_income"
	tradePriceScale = 12
)

// FixedIncomeApplication is a new application or a contribution (A236 FC11).
type FixedIncomeApplication struct {
	ApplicationID, BrokerageID, CashAccountID uuid.UUID
	AppliedOn                                 time.Time
	Amount                                    money.Money
	Fees                                      *money.Money
	Description                               string
	Contract                                  *Contract      // a new contract
	Instrument                                money.Currency // a contribution; empty with Contract
}

// FixedIncomeResult is the purchase an application recorded.
type FixedIncomeResult struct {
	Instrument    money.Currency
	TransactionID uuid.UUID
	Quantity      money.Money
	UnitPrice     money.Rate
	Replayed      bool // true: the application existed and nothing was written
}

// ApplyFixedIncome defines the contract of a new application and buys it with cash of the
// brokerage, or buys more of a contract the book holds (A236 FC11 to FC14).
func (s *Service) ApplyFixedIncome(
	ctx context.Context,
	booksID int64,
	a FixedIncomeApplication,
) (FixedIncomeResult, error) {
	if err := checkApplication(a); err != nil {
		return FixedIncomeResult{}, err
	}

	if a.Contract == nil {
		return s.contribute(ctx, booksID, a)
	}

	return s.applyNewContract(ctx, booksID, a)
}

func (s *Service) contribute(
	ctx context.Context,
	booksID int64,
	a FixedIncomeApplication,
) (FixedIncomeResult, error) {
	in, err := s.ins.Instrument(ctx, a.Instrument)
	if errors.Is(err, ErrUnknownInstrument) || (err == nil && !ownedContract(in, booksID)) {
		return FixedIncomeResult{}, fmt.Errorf("%w: %w", ErrUnknownInstrument, ErrNotFound)
	}

	if err != nil {
		return FixedIncomeResult{}, err
	}

	price, err := s.unitPrice(ctx, in.Code, in.QuoteCurrency, a.AppliedOn)
	if err != nil {
		return FixedIncomeResult{}, err
	}

	return s.buy(ctx, booksID, a, in.Code, in.Scale, price)
}

func (s *Service) applyNewContract(
	ctx context.Context,
	booksID int64,
	a FixedIncomeApplication,
) (FixedIncomeResult, error) {
	c, err := s.checkContract(ctx, booksID, a)
	if err != nil {
		return FixedIncomeResult{}, err
	}

	in, err := s.ins.Instrument(ctx, c.Code)
	exists := err == nil

	if err != nil && !errors.Is(err, ErrUnknownInstrument) {
		return FixedIncomeResult{}, err
	}

	if exists && !ownedContract(in, booksID) {
		return FixedIncomeResult{}, fieldErr(
			"application_id", "is used by another contract", domain.ErrValidation,
		)
	}

	if exists {
		if r, ok, err := s.replayed(ctx, booksID, a, c.Code); ok || err != nil {
			return r, err
		}
	}

	price, err := s.openingPrice(ctx, a, c)
	if err != nil {
		return FixedIncomeResult{}, err
	}

	if !exists {
		if err := s.contracts.Define(ctx, booksID, c); err != nil {
			return FixedIncomeResult{}, err
		}

		in, err = s.ins.Instrument(ctx, c.Code)
		if err != nil {
			return FixedIncomeResult{}, errors.Join(err, s.contracts.Discard(ctx, booksID, c.Code))
		}
	}

	r, err := s.buy(ctx, booksID, a, c.Code, in.Scale, price)
	if err != nil && !exists {
		err = errors.Join(err, s.contracts.Discard(ctx, booksID, c.Code))
	}

	return r, err
}

// openingPrice is 1 on the issue date of the contract; a later date takes the stored price.
func (s *Service) openingPrice(
	ctx context.Context,
	a FixedIncomeApplication,
	c Contract,
) (money.Rate, error) {
	if a.AppliedOn.Equal(c.IssuedOn) {
		return money.NewRate(1, 0)
	}

	return s.unitPrice(ctx, c.Code, c.Currency, a.AppliedOn)
}

// checkContract fills the defaults that depend on the application and runs the contract's checks.
func (s *Service) checkContract(
	ctx context.Context,
	booksID int64,
	a FixedIncomeApplication,
) (Contract, error) {
	c := *a.Contract
	c.Currency = a.Amount.Currency()

	if c.IssuedOn.IsZero() {
		c.IssuedOn = a.AppliedOn
	}

	p, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return Contract{}, err
	}

	c.Region = p.Region

	return s.contracts.Check(ctx, booksID, c, a.ApplicationID)
}

// replayed returns the first purchase of an application that already ran: the holding account
// of the contract under the brokerage and its first buy. False adopts a defined contract that no
// purchase used.
func (s *Service) replayed(
	ctx context.Context,
	booksID int64,
	a FixedIncomeApplication,
	code money.Currency,
) (FixedIncomeResult, bool, error) {
	children, err := s.repo.ChildAccounts(ctx, booksID, a.BrokerageID)
	if err != nil {
		return FixedIncomeResult{}, false, err
	}

	for _, child := range children {
		if child.Instrument != code {
			continue
		}

		id, ok, err := s.repo.FirstBuy(ctx, booksID, child.ID)
		if err != nil || !ok {
			return FixedIncomeResult{}, false, err
		}

		t, err := s.repo.Transaction(ctx, booksID, id)
		if err != nil {
			return FixedIncomeResult{}, false, err
		}

		return FixedIncomeResult{
			Instrument:    code,
			TransactionID: t.ID,
			Quantity:      t.Trade.Quantity,
			UnitPrice:     t.Trade.UnitPrice,
			Replayed:      true,
		}, true, nil
	}

	return FixedIncomeResult{}, false, nil
}

// unitPrice is the chosen price of the latest date up to date; a weekend takes the accrual of
// the previous business day.
func (s *Service) unitPrice(
	ctx context.Context,
	code, quote money.Currency,
	date time.Time,
) (money.Rate, error) {
	price, ok, err := s.contracts.Price(ctx, code, quote, date)
	if err != nil {
		return money.Rate{}, err
	}

	if !ok {
		return money.Rate{}, fieldErr(
			"applied_on", "no price of the contract on or before this date", ErrPriceMissing,
		)
	}

	return price, nil
}

// buy records the purchase of amount at price: the quantity is amount over price and the trade
// price is amount over quantity, so the gross of the trade equals amount (A236 FC13).
func (s *Service) buy(
	ctx context.Context,
	booksID int64,
	a FixedIncomeApplication,
	code money.Currency,
	scale int,
	price money.Rate,
) (FixedIncomeResult, error) {
	units, err := quantityOf(a.Amount, price, scale)
	if err != nil {
		return FixedIncomeResult{}, err
	}

	quantity, err := AmountOf(ctx, s.ins, units, code)
	if err != nil {
		return FixedIncomeResult{}, err
	}

	unit, err := tradeUnitPrice(a.Amount, units, scale)
	if err != nil {
		return FixedIncomeResult{}, err
	}

	t, err := s.RecordTrade(ctx, booksID, domain.TradeOrder{
		BrokerageID:   a.BrokerageID,
		Instrument:    code,
		CashAccountID: a.CashAccountID,
		Side:          domain.SideBuy,
		Date:          a.AppliedOn,
		Quantity:      quantity,
		UnitPrice:     unit,
		Fees:          a.Fees,
		Description:   a.Description,
	})
	if err != nil {
		return FixedIncomeResult{}, err
	}

	return FixedIncomeResult{
		Instrument: code, TransactionID: t.ID, Quantity: quantity, UnitPrice: unit,
	}, nil
}

func checkApplication(a FixedIncomeApplication) error {
	if (a.Contract == nil) == (a.Instrument == "") {
		return fieldErr("contract", "set contract or instrument", domain.ErrValidation)
	}

	if a.Amount.Amount() <= 0 {
		return fieldErr("amount", "must be positive", domain.ErrValidation)
	}

	return nil
}

func ownedContract(in Instrument, booksID int64) bool {
	return in.Type == fixedIncomeType && in.BooksID == booksID
}

// quantityOf is amount over price in the minor units of an instrument of the given scale, half
// to even.
func quantityOf(amount money.Money, price money.Rate, scale int) (int64, error) {
	if price.Mantissa() <= 0 {
		return 0, fieldErr(
			"applied_on",
			"the price of the contract is not positive",
			ErrPriceMissing,
		)
	}

	num := new(big.Int).Mul(big.NewInt(amount.Amount()), pow10(price.Scale()+scale))
	den := new(big.Int).Mul(pow10(amount.Scale()), big.NewInt(price.Mantissa()))

	units, ok := divHalfEven(num, den)
	if !ok || units == 0 {
		return 0, fieldErr("amount", "is too small for the unit price", domain.ErrValidation)
	}

	return units, nil
}

// tradeUnitPrice is amount over the quantity at 12 decimals, half to even (A228 IO1).
func tradeUnitPrice(amount money.Money, units int64, scale int) (money.Rate, error) {
	num := new(big.Int).Mul(big.NewInt(amount.Amount()), pow10(scale+tradePriceScale))
	den := new(big.Int).Mul(pow10(amount.Scale()), big.NewInt(units))

	mantissa, ok := divHalfEven(num, den)
	if !ok {
		return money.Rate{}, fieldErr(
			"amount",
			"is too large for the quantity",
			domain.ErrValidation,
		)
	}

	return money.NewRate(mantissa, tradePriceScale)
}

// divHalfEven divides positive integers, rounding half to even; false when the result exceeds
// int64.
func divHalfEven(num, den *big.Int) (int64, bool) {
	q, r := new(big.Int).QuoRem(num, den, new(big.Int))

	switch r.Lsh(r, 1).Cmp(den) {
	case 1:
		q.Add(q, big.NewInt(1))
	case 0:
		if q.Bit(0) == 1 {
			q.Add(q, big.NewInt(1))
		}
	}

	return q.Int64(), q.IsInt64()
}

func pow10(n int) *big.Int {
	return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil)
}

// FixedIncomeUnitPrice is the price a contribution to the contract of a book reads on a date.
func (s *Service) FixedIncomeUnitPrice(
	ctx context.Context,
	booksID int64,
	code money.Currency,
	on time.Time,
) (money.Rate, error) {
	in, err := s.ins.Instrument(ctx, code)
	if errors.Is(err, ErrUnknownInstrument) || (err == nil && !ownedContract(in, booksID)) {
		return money.Rate{}, fmt.Errorf("%w: %w", ErrUnknownInstrument, ErrNotFound)
	}

	if err != nil {
		return money.Rate{}, err
	}

	return s.unitPrice(ctx, in.Code, in.QuoteCurrency, on)
}
