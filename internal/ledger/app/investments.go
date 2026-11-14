package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// InvestmentFacts are the non-voided facts of the security accounts of one brokerage,
// read by Portfolio (P8 amendment A71). Money amounts are in Currency's minor units.
type InvestmentFacts struct {
	Currency   money.Currency
	Securities []SecurityFact
	Postings   []HoldingPosting
	Trades     []TradeFact
	Incomes    []IncomeFact
}

type SecurityFact struct {
	AccountID  uuid.UUID
	Instrument money.Currency
}

type HoldingPosting struct {
	AccountID, TransactionID uuid.UUID
	Date                     time.Time
	Quantity, Weight         int64
}

type TradeFact struct {
	TransactionID, AccountID           uuid.UUID
	Date                               time.Time
	Side                               string
	Quantity, Gross, Fees, Taxes, Cost int64
	DayTradeQuantity, DayTradeCost     int64
}

type IncomeFact struct {
	TransactionID, AccountID uuid.UUID
	Date                     time.Time
	Type                     string
	Gross, Withheld          int64
}

// InvestmentFacts returns the facts of the children of brokerageID that hold a security.
func (s *Service) InvestmentFacts(
	ctx context.Context,
	booksID int64,
	brokerageID uuid.UUID,
) (InvestmentFacts, error) {
	settings, err := s.repo.Settings(ctx, booksID)
	if err != nil {
		return InvestmentFacts{}, err
	}

	accounts, err := s.repo.AllAccounts(ctx, booksID)
	if err != nil {
		return InvestmentFacts{}, err
	}

	out := InvestmentFacts{Currency: settings.BaseCurrency}

	var ids []uuid.UUID
	for _, a := range accounts {
		if a.ParentID == brokerageID && a.HoldsSecurity() {
			out.Securities = append(
				out.Securities,
				SecurityFact{AccountID: a.ID, Instrument: a.Instrument},
			)
			ids = append(ids, a.ID)
		}
	}

	if len(ids) == 0 {
		return out, nil
	}

	if out.Postings, err = s.repo.SecurityPostings(ctx, booksID, ids); err != nil {
		return InvestmentFacts{}, err
	}

	if out.Trades, err = s.repo.SecurityTrades(ctx, booksID, ids); err != nil {
		return InvestmentFacts{}, err
	}

	out.Incomes, err = s.repo.SecurityIncomes(ctx, booksID, ids)

	return out, err
}

// AmountOf builds an amount of code; a security takes its scale from Market data.
func AmountOf(
	ctx context.Context,
	ins Instruments,
	units int64,
	code money.Currency,
) (money.Money, error) {
	if _, err := money.ParseCurrency(string(code)); err == nil {
		return money.New(units, code)
	}

	if ins == nil {
		return money.Money{}, fmt.Errorf("amount of %s: %w", code, ErrUnknownInstrument)
	}

	in, err := ins.Instrument(ctx, code)
	if err != nil {
		return money.Money{}, fmt.Errorf("amount of %s: %w", code, err)
	}

	return money.NewOf(units, code, in.Scale)
}

// AmountOf is AmountOf with the service's instruments, for the HTTP adapter.
func (s *Service) AmountOf(
	ctx context.Context,
	units int64,
	code money.Currency,
) (money.Money, error) {
	return AmountOf(ctx, s.ins, units, code)
}

// ResolveCode returns the instrument an order names by code (A228 IO4).
func (s *Service) ResolveCode(
	ctx context.Context,
	code money.Currency,
) (money.Currency, error) {
	if s.ins == nil {
		return code, nil
	}

	return s.ins.ResolveCode(ctx, code)
}

// describeInstrument sets the quote currency of a security account (P8 amendment A63).
func (s *Service) describeInstrument(ctx context.Context, a *domain.Account) error {
	if !a.HoldsSecurity() {
		return nil
	}

	in, err := s.ins.Instrument(ctx, a.Instrument)
	if err != nil {
		return &domain.FieldError{
			Field:   "currency",
			Message: "is not a known instrument",
			Err:     domain.ErrValidation,
		}
	}

	a.QuoteCurrency = in.QuoteCurrency

	return nil
}
