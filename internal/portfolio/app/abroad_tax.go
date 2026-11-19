package app

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// AbroadTax returns the annual tax of the financial investments held abroad for the tax year that
// starts in year, in the base currency it returns; false when the jurisdiction has none or the
// year has no item (coverage row U-08). An investment is held abroad when its quote currency is
// not the base currency; every sale and income up to the end of year counts, so the losses carried
// from earlier years do.
func (s *Service) AbroadTax(
	ctx context.Context,
	booksID int64,
	year int,
) (domain.AbroadYear, money.Currency, bool, error) {
	j, err := s.juris.For(ctx, booksID)
	if err != nil || j == nil {
		return domain.AbroadYear{}, "", false, err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return domain.AbroadYear{}, "", false, err
	}

	_, to := j.TaxYear(year)

	items, err := s.abroadItems(ctx, booksID, base, to)
	if err != nil {
		return domain.AbroadYear{}, "", false, err
	}

	for _, y := range j.AbroadTax(items) {
		if y.Year == year {
			return y, base, true, nil
		}
	}

	return domain.AbroadYear{}, base, false, nil
}

// abroadItems are the results and the incomes before to of the instruments quoted in a currency
// other than base; an income in another currency is converted on its date.
func (s *Service) abroadItems(
	ctx context.Context,
	booksID int64,
	base money.Currency,
	to time.Time,
) ([]domain.AbroadItem, error) {
	abroad := abroadFilter{s: s, base: base, seen: map[money.Currency]bool{}}

	results, err := s.repo.RealizedResults(ctx, booksID, time.Time{}, to)
	if err != nil {
		return nil, err
	}

	var out []domain.AbroadItem

	for _, r := range results {
		ok, err := abroad.holds(ctx, r.Instrument)
		if err != nil {
			return nil, err
		}

		if ok && r.Date.Before(to) {
			out = append(out, domain.AbroadItem{Year: r.Date.Year(), Amount: r.Result})
		}
	}

	incomes, err := s.repo.IncomeEvents(ctx, booksID, time.Time{}, to.AddDate(0, 0, -1))
	if err != nil {
		return nil, err
	}

	for _, e := range incomes {
		item, ok, err := s.abroadIncome(ctx, abroad, e)
		if err != nil {
			return nil, err
		}

		if ok {
			out = append(out, item)
		}
	}

	return out, nil
}

// abroadFilter tells, once per instrument, whether it is quoted in a currency other than base.
type abroadFilter struct {
	s    *Service
	base money.Currency
	seen map[money.Currency]bool
}

func (f abroadFilter) holds(ctx context.Context, code money.Currency) (bool, error) {
	if v, ok := f.seen[code]; ok {
		return v, nil
	}

	info, err := f.s.md.InstrumentOf(ctx, code)
	f.seen[code] = err == nil && info.QuoteCurrency != "" && info.QuoteCurrency != f.base

	return f.seen[code], err
}

// abroadIncome is income e in base, converted on its date when it is in another currency; false
// when its instrument is not held abroad.
func (s *Service) abroadIncome(
	ctx context.Context,
	abroad abroadFilter,
	e domain.IncomeEvent,
) (domain.AbroadItem, bool, error) {
	ok, err := abroad.holds(ctx, e.Instrument)
	if err != nil || !ok {
		return domain.AbroadItem{}, false, err
	}

	base := abroad.base
	item := domain.AbroadItem{Year: e.Date.Year(), Amount: e.Gross, Withheld: e.Withheld}

	if e.Currency == "" || e.Currency == base {
		return item, true, nil
	}

	for _, v := range []*int64{&item.Amount, &item.Withheld} {
		m, err := money.New(*v, e.Currency)
		if err != nil {
			return domain.AbroadItem{}, false, err
		}

		c, _, err := s.md.Convert(ctx, m, base, e.Date)
		if err != nil {
			return domain.AbroadItem{}, false, err
		}

		*v = c.Amount()
	}

	return item, true, nil
}
