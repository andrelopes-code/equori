package app

import (
	"context"
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

	dates, err := s.unitTaxDates(ctx, rule, from, to)
	if err != nil || len(dates) == 0 {
		return nil, err
	}

	holdings, err := s.heldInstruments(ctx, booksID, from, to, func(info InstrumentInfo) bool {
		return info.Type == typeFund && slices.Contains(rule.Subtypes, info.Subtype)
	})
	if err != nil {
		return nil, err
	}

	var out []FixedIncomeEvent

	for _, h := range holdings {
		es, err := s.holdingUnitTax(ctx, booksID, h, dates, today, positions)
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

func (s *Service) holdingUnitTax(
	ctx context.Context,
	booksID int64,
	h holding,
	dates []time.Time,
	today time.Time,
	positions *positionCache,
) ([]FixedIncomeEvent, error) {
	scale, err := s.md.Scale(ctx, h.instrument)
	if err != nil {
		return nil, err
	}

	var out []FixedIncomeEvent

	for _, date := range dates {
		units, err := positions.held(ctx, h, date.AddDate(0, 0, -1))
		if err != nil {
			return nil, err
		}

		if units <= 0 {
			continue
		}

		quantity, err := money.NewOf(units, h.instrument, scale)
		if err != nil {
			return nil, err
		}

		recorded, err := s.ledger.UnitTaxDates(
			ctx,
			booksID,
			h.account,
			date.AddDate(0, 0, -domain.RecordWindowDays),
			date.AddDate(0, 0, domain.RecordWindowDays),
		)
		if err != nil {
			return nil, err
		}

		out = append(out, FixedIncomeEvent{
			AccountID:  h.account,
			Instrument: h.instrument,
			Date:       date,
			Kind:       domain.EventUnitTax,
			Quantity:   quantity,
			State:      domain.EventState(date, today, len(recorded) > 0),
		})
	}

	return out, nil
}
