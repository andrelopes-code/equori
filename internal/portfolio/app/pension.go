package app

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// DeductibleContributions returns what the tax year that starts in year paid into the plans whose
// contributions the book's jurisdiction lets an individual deduct, in the base currency; false
// when the jurisdiction has no such plan (coverage row U-05).
func (s *Service) DeductibleContributions(
	ctx context.Context,
	booksID int64,
	year int,
) (money.Money, bool, error) {
	j, err := s.juris.For(ctx, booksID)
	if err != nil || j == nil || len(j.DeductibleContributions()) == 0 {
		return money.Money{}, false, err
	}

	from, to := j.TaxYear(year)

	start, err := s.repo.PositionsAt(ctx, booksID, from.AddDate(0, 0, -1))
	if err != nil {
		return money.Money{}, false, err
	}

	end, err := s.repo.PositionsAt(ctx, booksID, to.AddDate(0, 0, -1))
	if err != nil {
		return money.Money{}, false, err
	}

	sales, err := s.repo.RealizedResults(ctx, booksID, from, to)
	if err != nil {
		return money.Money{}, false, err
	}

	plans, err := s.deductiblePlans(ctx, j, start, end)
	if err != nil {
		return money.Money{}, false, err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return money.Money{}, false, err
	}

	for _, r := range sales {
		if slices.Contains(j.DeductibleContributions(), r.TaxClass) {
			plans[r.AccountID] = true
		}
	}

	total := domain.YearContributions(
		start,
		end,
		sales,
		func(id uuid.UUID) bool { return plans[id] },
	)
	m, err := money.New(total, base)

	return m, true, err
}

// deductiblePlans marks the holdings whose instrument has a tax class with deductible
// contributions; the caller adds a holding bought and sold out within the year from its sales.
func (s *Service) deductiblePlans(
	ctx context.Context,
	j domain.Jurisdiction,
	positions ...[]domain.PositionDay,
) (map[uuid.UUID]bool, error) {
	classes := j.DeductibleContributions()
	plans := map[uuid.UUID]bool{}
	known := map[money.Currency]bool{}

	for _, rows := range positions {
		for _, p := range rows {
			deductible, ok := known[p.Instrument]
			if !ok {
				info, err := s.md.InstrumentOf(ctx, p.Instrument)
				if err != nil {
					return nil, err
				}

				deductible = slices.Contains(classes, j.TaxClass(info.Type, info.Subtype, ""))
				known[p.Instrument] = deductible
			}

			if deductible {
				plans[p.AccountID] = true
			}
		}
	}

	return plans, nil
}
