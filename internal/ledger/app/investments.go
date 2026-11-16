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

// lockHolding locks the security account and returns the holding it has on date.
func (s *Service) lockHolding(
	ctx context.Context,
	r Repository,
	booksID int64,
	security domain.Account,
	base money.Currency,
	date time.Time,
	exclude uuid.UUID,
) (domain.Holding, error) {
	// Two sales of one account serialize on its row, so each reads the holding the other left.
	if _, err := r.LockAccount(ctx, booksID, security.ID); err != nil {
		return domain.Holding{}, err
	}

	return s.readHolding(ctx, r, booksID, security, base, date, exclude)
}

// readHolding returns the holding of the security account on date without locking it.
func (s *Service) readHolding(
	ctx context.Context,
	r Repository,
	booksID int64,
	security domain.Account,
	base money.Currency,
	date time.Time,
	exclude uuid.UUID,
) (domain.Holding, error) {
	quantity, basis, err := r.Holding(ctx, booksID, security.ID, date, exclude)
	if err != nil {
		return domain.Holding{}, err
	}

	var h domain.Holding
	if h.Quantity, err = s.AmountOf(ctx, quantity, security.Instrument); err != nil {
		return domain.Holding{}, err
	}

	if h.CostBasis, err = money.New(basis, base); err != nil {
		return domain.Holding{}, err
	}

	return h, nil
}

// HoldingLots is a security account on a date: the cost method a sale of it uses, its holding
// and, under the lot method, the open lots (A234 FL11).
type HoldingLots struct {
	Method string
	// EstimatesWithholding is true when EstimateWithholding answers for the account: the book's
	// region taxes the security at source (A235 FS4).
	EstimatesWithholding bool
	Quantity, CostBasis  money.Money
	Lots                 []OpenLot
}

// OpenLot is the part of a holding bought on one date.
type OpenLot struct {
	AcquiredOn     time.Time
	Quantity, Cost money.Money
}

// OpenLots returns the cost method, the holding and the open lots of a security account at the
// end of date without the postings of the transaction exclude, if any. The lots are empty under
// the average method.
func (s *Service) OpenLots(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	exclude uuid.UUID,
) (HoldingLots, error) {
	base, err := baseCurrency(ctx, s.repo, booksID)
	if err != nil {
		return HoldingLots{}, err
	}

	security, err := s.repo.Account(ctx, booksID, accountID)
	if err != nil {
		return HoldingLots{}, err
	}

	if !security.HoldsSecurity() {
		return HoldingLots{}, fieldErr("id", "must hold a security", domain.ErrValidation)
	}

	h, err := s.readHolding(ctx, s.repo, booksID, security, base, date, exclude)
	if err != nil {
		return HoldingLots{}, err
	}

	h, err = s.withCostMethod(ctx, s.repo, booksID, security, h, date, exclude)
	if err != nil {
		return HoldingLots{}, err
	}

	_, estimates, err := s.withholdingTable(ctx, booksID, security)
	if err != nil {
		return HoldingLots{}, err
	}

	out := HoldingLots{
		Method:               h.Method,
		EstimatesWithholding: estimates,
		Quantity:             h.Quantity,
		CostBasis:            h.CostBasis,
	}
	if out.Method == "" {
		out.Method = domain.CostAverage
	}

	for _, l := range h.Lots {
		lot, err := s.openLot(ctx, l, security.Instrument, base)
		if err != nil {
			return HoldingLots{}, err
		}

		out.Lots = append(out.Lots, lot)
	}

	return out, nil
}

func (s *Service) openLot(
	ctx context.Context,
	l domain.Lot,
	instrument, base money.Currency,
) (OpenLot, error) {
	quantity, err := s.AmountOf(ctx, l.Quantity, instrument)
	if err != nil {
		return OpenLot{}, err
	}

	cost, err := money.New(l.Cost, base)
	if err != nil {
		return OpenLot{}, err
	}

	return OpenLot{AcquiredOn: l.AcquiredOn, Quantity: quantity, Cost: cost}, nil
}

// withCostMethod gives h the cost method of its instrument in the book's region and, under
// fixed income lots, the open lots on date. A holding whose lots disagree with its quantity
// is a defect of the derivation and fails the operation (FL8).
func (s *Service) withCostMethod(
	ctx context.Context,
	r Repository,
	booksID int64,
	security domain.Account,
	h domain.Holding,
	date time.Time,
	exclude uuid.UUID,
) (domain.Holding, error) {
	profile, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return domain.Holding{}, fmt.Errorf("read profile: %w", err)
	}

	in, err := s.ins.Instrument(ctx, security.Instrument)
	if err != nil {
		return domain.Holding{}, err
	}

	if s.defaults.CostMethod(profile.Region, in.Type) != domain.CostFIFO {
		return h, nil
	}

	lots, err := s.openLots(ctx, r, booksID, security.ID, date, uuid.Nil, exclude)
	if err != nil {
		return domain.Holding{}, fmt.Errorf("open lots of account %s: %w", security.ID, err)
	}

	if openQuantity(lots) != h.Quantity.Amount() {
		return domain.Holding{}, fmt.Errorf(
			"open lots of account %s hold %d units, the holding %d: %w",
			security.ID, openQuantity(lots), h.Quantity.Amount(), domain.ErrLotsInconsistent,
		)
	}

	h.Method, h.Lots = domain.CostFIFO, lots

	return h, nil
}

// openLots replays the postings of an account up to date; a transfer in reads the open lots of
// its source just before the transfer.
func (s *Service) openLots(
	ctx context.Context,
	r Repository,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	beforeTx, exclude uuid.UUID,
) ([]domain.Lot, error) {
	postings, err := r.OpenLotPostings(ctx, booksID, accountID, date, beforeTx, exclude)
	if err != nil {
		return nil, err
	}

	return domain.ReplayLots(postings, func(p domain.LotPosting) ([]domain.Lot, error) {
		return s.openLots(ctx, r, booksID, p.Source, p.Date, p.TransactionID, exclude)
	})
}

func openQuantity(lots []domain.Lot) (units int64) {
	for _, l := range lots {
		units += l.Quantity
	}

	return units
}
