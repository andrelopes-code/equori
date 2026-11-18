package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

const typeFund = "fund"

// unitTaxEvents are the unit taxes dated in [from, to] of the funds the book held, on the last
// business day of the months of its jurisdiction (A236 FC26); none without a jurisdiction case.
func (s *Service) unitTaxEvents(
	ctx context.Context,
	booksID int64,
	from, to, today time.Time,
	positions *positionCache,
) ([]FixedIncomeEvent, error) {
	j, err := s.juris.For(ctx, booksID)
	if err != nil || j == nil {
		return nil, err
	}

	rule, ok := j.UnitTax()
	if !ok {
		return nil, nil
	}

	// The dates start a period earlier: the one before from is the previous come-cotas.
	dates, err := s.unitTaxDates(ctx, rule, from.AddDate(0, -7, 0), to)
	if err != nil || len(dates) == 0 || dates[len(dates)-1].Before(from) {
		return nil, err
	}

	holdings, err := s.heldInstruments(ctx, booksID, from, to, func(info InstrumentInfo) bool {
		return info.Type == typeFund && slices.Contains(rule.Subtypes, info.Subtype)
	})
	if err != nil {
		return nil, err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return nil, err
	}

	ut := unitTaxRun{
		rule:      rule,
		dates:     dates,
		from:      from,
		today:     today,
		base:      base,
		positions: positions,
	}

	var out []FixedIncomeEvent

	for _, h := range holdings {
		es, err := s.holdingUnitTax(ctx, booksID, h, ut)
		if err != nil {
			return nil, err
		}

		out = append(out, es...)
	}

	return out, nil
}

// unitTaxDates are the last business days of the months of rule in [from, to].
func (s *Service) unitTaxDates(
	ctx context.Context,
	rule domain.UnitTax,
	from, to time.Time,
) ([]time.Time, error) {
	var out []time.Time

	for year := from.Year(); year <= to.Year(); year++ {
		for _, month := range rule.Months {
			lastDay := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC)

			d, err := s.md.Adjust(ctx, rule.Calendar, lastDay, true)
			if err != nil {
				return nil, err
			}

			if !d.Before(from) && !d.After(to) {
				out = append(out, d)
			}
		}
	}

	return out, nil
}

// unitTaxRun is what the unit tax events of every holding share: dates holds the come-cotas from
// the one before from.
type unitTaxRun struct {
	rule        domain.UnitTax
	dates       []time.Time
	from, today time.Time
	base        money.Currency
	positions   *positionCache
}

func (s *Service) holdingUnitTax(
	ctx context.Context,
	booksID int64,
	h holding,
	ut unitTaxRun,
) ([]FixedIncomeEvent, error) {
	info, err := s.md.InstrumentOf(ctx, h.instrument)
	if err != nil {
		return nil, err
	}

	scale, err := s.md.Scale(ctx, h.instrument)
	if err != nil {
		return nil, err
	}

	var out []FixedIncomeEvent

	for i, date := range ut.dates {
		p, err := ut.positions.position(ctx, h, date.AddDate(0, 0, -1))
		if err != nil {
			return nil, err
		}

		if date.Before(ut.from) || p.Quantity <= 0 {
			continue
		}

		quantity, err := money.NewOf(p.Quantity, h.instrument, scale)
		if err != nil {
			return nil, err
		}

		e, err := s.unitTaxEvent(ctx, booksID, h, ut.today, date, quantity)
		if err != nil {
			return nil, err
		}

		if rate, ok := ut.rule.RateBP[info.Subtype]; ok {
			e.EstimatedTax, err = s.unitTaxEstimate(ctx, ut, i, quantity, p.CostBasis, rate)
			if err != nil {
				return nil, err
			}
		}

		out = append(out, e)
	}

	return out, nil
}

// unitTaxEvent is the unit tax of quantity of h on date, recorded when the account holds a unit
// tax within the window.
func (s *Service) unitTaxEvent(
	ctx context.Context,
	booksID int64,
	h holding,
	today, date time.Time,
	quantity money.Money,
) (FixedIncomeEvent, error) {
	recorded, err := s.ledger.UnitTaxDates(
		ctx,
		booksID,
		h.account,
		date.AddDate(0, 0, -domain.RecordWindowDays),
		date.AddDate(0, 0, domain.RecordWindowDays),
	)

	return FixedIncomeEvent{
		AccountID:  h.account,
		Instrument: h.instrument,
		Date:       date,
		Kind:       domain.EventUnitTax,
		Quantity:   quantity,
		State:      domain.EventState(date, today, len(recorded) > 0),
	}, err
}

// unitTaxEstimate is the come-cotas of quantity on date i of ut at rate, against its cost and its
// value at the previous come-cotas; nil when the price of the date is missing.
func (s *Service) unitTaxEstimate(
	ctx context.Context,
	ut unitTaxRun,
	i int,
	quantity money.Money,
	cost int64,
	rateBP int,
) (*money.Money, error) {
	base := ut.base

	now, _, err := s.md.Convert(ctx, quantity, base, ut.dates[i])
	if errors.Is(err, ErrPriceMissing) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	var before int64

	if i > 0 {
		v, _, err := s.md.Convert(ctx, quantity, base, ut.dates[i-1])
		if err != nil && !errors.Is(err, ErrPriceMissing) {
			return nil, err
		}

		if err == nil {
			before = v.Amount()
		}
	}

	tax, err := money.New(domain.UnitTaxEstimate(now.Amount(), cost, before, rateBP), base)

	return &tax, err
}
