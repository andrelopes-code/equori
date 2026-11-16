package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// WithholdingEstimate is the tax a broker withholds on a sale of a taxed fixed income security.
type WithholdingEstimate struct {
	IncomeTax, IOF, Net money.Money
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

	table, err := s.withholdingTable(ctx, booksID, security)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	if units <= 0 || proceedsMinor < 0 {
		return WithholdingEstimate{}, fieldErr(
			"quantity",
			"must be at least one unit, and proceeds at least zero",
			domain.ErrValidation,
		)
	}

	h, err := s.readHolding(ctx, s.repo, booksID, security, base, date, uuid.Nil)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	h, err = s.withCostMethod(ctx, s.repo, booksID, security, h, date, uuid.Nil)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	cost, err := domain.FIFOCost(h.Lots, units)
	if err != nil {
		return WithholdingEstimate{}, fieldErr(
			"quantity",
			"exceeds the position",
			domain.ErrValidation,
		)
	}

	consumed, _, err := domain.ConsumeLots(h.Lots, units, cost)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	w := domain.EstimateWithholding(table, consumed, proceedsMinor, date)

	return withholdingMoney(w, proceedsMinor, base)
}

// withholdingTable returns the withholding table of the security, or a validation error when
// the book's region does not tax it at source.
func (s *Service) withholdingTable(
	ctx context.Context,
	booksID int64,
	security domain.Account,
) (domain.WithholdingTable, error) {
	profile, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return domain.WithholdingTable{}, fmt.Errorf("read profile: %w", err)
	}

	if !security.HoldsSecurity() {
		return domain.WithholdingTable{}, fieldErr(
			"id",
			"must hold a security",
			domain.ErrValidation,
		)
	}

	in, err := s.ins.Instrument(ctx, security.Instrument)
	if err != nil {
		return domain.WithholdingTable{}, err
	}

	subtype, err := s.ins.Subtype(ctx, security.Instrument)
	if err != nil {
		return domain.WithholdingTable{}, err
	}

	table, ok := s.defaults.FixedIncomeWithholding(profile.Region, in.Type, subtype)
	if !ok {
		return domain.WithholdingTable{}, fieldErr(
			"id",
			"holds no fixed income security taxed at source",
			domain.ErrValidation,
		)
	}

	return table, nil
}

func withholdingMoney(
	w domain.Withholding,
	proceeds int64,
	base money.Currency,
) (WithholdingEstimate, error) {
	tax, err := money.New(w.IncomeTax, base)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	iof, err := money.New(w.IOF, base)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	net, err := money.New(proceeds-w.IncomeTax-w.IOF, base)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	return WithholdingEstimate{IncomeTax: tax, IOF: iof, Net: net}, nil
}
