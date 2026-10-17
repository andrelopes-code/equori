package app

import (
	"context"
	"time"

	"github.com/google/uuid"

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
}

type IncomeFact struct {
	TransactionID, AccountID uuid.UUID
	Date                     time.Time
	Type                     string
	Gross, Withheld          int64
}

// InvestmentFacts returns the facts of the children of brokerageID that hold a security.
func (s *Service) InvestmentFacts(ctx context.Context, userID int64, brokerageID uuid.UUID) (InvestmentFacts, error) {
	settings, err := s.repo.Settings(ctx, userID)
	if err != nil {
		return InvestmentFacts{}, err
	}
	accounts, err := s.repo.AllAccounts(ctx, userID)
	if err != nil {
		return InvestmentFacts{}, err
	}
	out := InvestmentFacts{Currency: settings.BaseCurrency}
	var ids []uuid.UUID
	for _, a := range accounts {
		if a.ParentID == brokerageID && a.HoldsSecurity() {
			out.Securities = append(out.Securities, SecurityFact{AccountID: a.ID, Instrument: a.Instrument})
			ids = append(ids, a.ID)
		}
	}
	if len(ids) == 0 {
		return out, nil
	}
	if out.Postings, err = s.repo.SecurityPostings(ctx, userID, ids); err != nil {
		return InvestmentFacts{}, err
	}
	if out.Trades, err = s.repo.SecurityTrades(ctx, userID, ids); err != nil {
		return InvestmentFacts{}, err
	}
	out.Incomes, err = s.repo.SecurityIncomes(ctx, userID, ids)
	return out, err
}
