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

// WithholdingEstimate is the tax a broker withholds on a sale of a taxed fixed income security.
// CustodyFee is the fee of the custodian the sale deducts, nil when the security has no rule; Net
// is the proceeds less the tax and the fee.
type WithholdingEstimate struct {
	IncomeTax, IOF, Net money.Money
	CustodyFee          *money.Money
}

// EstimateWithholding returns the income tax and the IOF a sale of quantity units of a security
// for proceeds would withhold on date, from the open lots it consumes (A235 FS4). It is an
// estimate: the notice of the broker is the figure to record.
func (s *Service) EstimateWithholding(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	date time.Time,
	units, proceedsMinor int64,
) (WithholdingEstimate, error) {
	base, err := baseCurrency(ctx, s.repo, booksID)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	security, err := s.repo.Account(ctx, booksID, accountID)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	table, custody, ok, err := s.withholdingTable(ctx, booksID, security)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	if !ok {
		return WithholdingEstimate{}, fieldErr(
			"id",
			"holds no fixed income security taxed at source",
			domain.ErrValidation,
		)
	}

	if units <= 0 || proceedsMinor < 0 {
		return WithholdingEstimate{}, fieldErr(
			"quantity",
			"must be at least one unit, and proceeds at least zero",
			domain.ErrValidation,
		)
	}

	consumed, err := s.consumedLots(ctx, booksID, security, base, date, units, table.Flat())
	if err != nil {
		return WithholdingEstimate{}, err
	}

	w := domain.EstimateWithholding(table, consumed, proceedsMinor, date)

	fee, err := s.custodyFee(ctx, booksID, security, custody, consumed, base, date, proceedsMinor)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	return withholdingMoney(w, fee, proceedsMinor, base)
}

// custodyFee is the custody fee of the sale of the consumed lots of security for proceeds under
// rule; nil when the rule does not apply on date.
func (s *Service) custodyFee(
	ctx context.Context,
	booksID int64,
	security domain.Account,
	rule domain.CustodyRule,
	consumed []domain.Lot,
	base money.Currency,
	date time.Time,
	proceeds int64,
) (*int64, error) {
	if !rule.Applies(date) {
		return nil, nil
	}

	if rule.ReceiptBP > 0 {
		fee, ok := domain.ReceiptFee(rule, proceeds, date)
		if !ok {
			return nil, nil
		}

		return &fee, nil
	}

	var units int64
	for _, l := range consumed {
		units += l.Quantity
	}

	pool, err := s.custodyPool(ctx, booksID, security, rule, base, date, units, proceeds)
	if err != nil {
		return nil, err
	}

	fee := domain.CustodyFee(rule, consumed, proceeds, pool, date)

	return &fee, nil
}

// custodyPool is the value on date of the book's securities that share the custody exemption of
// security, the book read as one holder: security valued as the sale of units for proceeds scales
// to its whole holding, each other one at its price, or at its cost when it has none; zero when
// the rule shares the exemption with none.
func (s *Service) custodyPool(
	ctx context.Context,
	booksID int64,
	security domain.Account,
	rule domain.CustodyRule,
	base money.Currency,
	date time.Time,
	units, proceeds int64,
) (int64, error) {
	if rule.Pooled == nil || rule.ExemptMinor <= 0 {
		return 0, nil
	}

	all, err := s.repo.AllAccounts(ctx, booksID)
	if err != nil {
		return 0, err
	}

	var pool int64

	for _, a := range all {
		if !a.HoldsSecurity() || !rule.Pooled(string(a.Instrument)) {
			continue
		}

		h, err := s.readHolding(ctx, s.repo, booksID, a, base, date, uuid.Nil)
		if err != nil {
			return 0, err
		}

		if h.Quantity.Amount() <= 0 {
			continue
		}

		if a.ID == security.ID {
			pool += share(proceeds, h.Quantity.Amount(), units)

			continue
		}

		c, err := s.prices.Convert(ctx, h.Quantity, base, date)
		switch {
		case errors.Is(err, ErrPriceMissing):
			pool += h.CostBasis.Amount()
		case err != nil:
			return 0, err
		default:
			pool += c.Value.Amount()
		}
	}

	return pool, nil
}

// share is amount × part ÷ whole, rounded down; amount when whole is zero.
func share(amount, part, whole int64) int64 {
	if whole == 0 {
		return amount
	}

	return new(big.Int).Div(
		new(big.Int).Mul(big.NewInt(amount), big.NewInt(part)),
		big.NewInt(whole),
	).Int64()
}

// ReceiptCustodyFee is the custody fee a receipt of amount of instrument on date pays, such as a
// monthly payment of an RendA+ (coverage row T-09); nil when the instrument has no fee by receipt
// in the book's region or the exemption of date is not known.
func (s *Service) ReceiptCustodyFee(
	ctx context.Context,
	booksID int64,
	instrument money.Currency,
	amount money.Money,
	date time.Time,
) (*money.Money, error) {
	profile, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("read profile: %w", err)
	}

	in, err := s.ins.Instrument(ctx, instrument)
	if err != nil {
		return nil, err
	}

	subtype, err := s.ins.Subtype(ctx, instrument)
	if err != nil {
		return nil, err
	}

	rule, _ := s.defaults.CustodyFee(profile.Region, in.Type, subtype, string(instrument))
	if rule.ReceiptBP <= 0 {
		return nil, nil
	}

	v, ok := domain.ReceiptFee(rule, amount.Amount(), date)
	if !ok {
		return nil, nil
	}

	fee, err := money.New(v, amount.Currency())

	return &fee, err
}

// consumedLots returns the open lots a sale of units of the security on date consumes, oldest
// first, at their FIFO cost. A holding at average cost has no lots: under a flat table, whose rate
// ignores the days held, it is one lot at its average cost (coverage row U-02).
func (s *Service) consumedLots(
	ctx context.Context,
	booksID int64,
	security domain.Account,
	base money.Currency,
	date time.Time,
	units int64,
	flat bool,
) ([]domain.Lot, error) {
	h, err := s.readHolding(ctx, s.repo, booksID, security, base, date, uuid.Nil)
	if err != nil {
		return nil, err
	}

	h, err = s.withCostMethod(ctx, s.repo, booksID, security, h, date, uuid.Nil)
	if err != nil {
		return nil, err
	}

	if h.Method != domain.CostFIFO && flat {
		h.Lots = []domain.Lot{
			{AcquiredOn: date, Quantity: h.Quantity.Amount(), Cost: h.CostBasis.Amount()},
		}
	}

	cost, err := domain.FIFOCost(h.Lots, units)
	if err != nil {
		return nil, fieldErr("quantity", "exceeds the position", domain.ErrValidation)
	}

	consumed, _, err := domain.ConsumeLots(h.Lots, units, cost)

	return consumed, err
}

// withholdingTable returns the withholding table of the security and whether the book's region
// taxes it at source.
func (s *Service) withholdingTable(
	ctx context.Context,
	booksID int64,
	security domain.Account,
) (table domain.WithholdingTable, custody domain.CustodyRule, ok bool, err error) {
	if !security.HoldsSecurity() {
		return table, custody, false, nil
	}

	profile, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return table, custody, false, fmt.Errorf("read profile: %w", err)
	}

	in, err := s.ins.Instrument(ctx, security.Instrument)
	if err != nil {
		return table, custody, false, err
	}

	subtype, err := s.ins.Subtype(ctx, security.Instrument)
	if err != nil {
		return table, custody, false, err
	}

	table, ok = s.defaults.FixedIncomeWithholding(profile.Region, in.Type, subtype)
	custody, _ = s.defaults.CustodyFee(
		profile.Region,
		in.Type,
		subtype,
		string(security.Instrument),
	)

	return table, custody, ok, nil
}

func withholdingMoney(
	w domain.Withholding,
	fee *int64,
	proceeds int64,
	base money.Currency,
) (WithholdingEstimate, error) {
	var out WithholdingEstimate

	net := proceeds - w.IncomeTax - w.IOF
	if fee != nil {
		f, err := money.New(*fee, base)
		if err != nil {
			return WithholdingEstimate{}, err
		}

		out.CustodyFee = &f
		net -= *fee
	}

	var err error
	for _, m := range []struct {
		dst *money.Money
		v   int64
	}{{&out.IncomeTax, w.IncomeTax}, {&out.IOF, w.IOF}, {&out.Net, net}} {
		if *m.dst, err = money.New(m.v, base); err != nil {
			return WithholdingEstimate{}, err
		}
	}

	return out, nil
}
