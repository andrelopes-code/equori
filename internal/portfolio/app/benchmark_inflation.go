package app

import (
	"context"
	"errors"
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// Inflation is the return net of inflation over the whole months [From, Until] (amendment A208
// R16).
type Inflation struct {
	Index    string
	From     time.Time
	Until    time.Time
	IndexBP  int
	ReturnBP int
	RealBP   int
}

// inflation sets the real return on p.report over the whole months of w on every day of which the
// tree held money (R16).
func (s *Service) inflation(ctx context.Context, p period, held func(time.Time) bool, w window) error {
	index, err := s.md.InflationIndex(ctx, p.booksID)
	if err != nil || index == "" || !s.inIndexCurrency(index, p.report) {
		return err
	}

	rates, err := s.md.MonthlyRates(ctx, index, p.from, p.to)
	if errors.Is(err, ErrUnknownIndex) || errors.Is(err, ErrIndexNotMonthly) {
		return nil
	}

	if err != nil {
		return err
	}

	byMonth := make(map[time.Time]float64, len(rates))
	for _, r := range rates {
		if heldMonth(r.Date, held) {
			byMonth[r.Date] = r.Rate
		}
	}

	first, until, monthly, ok := domain.WholeMonths(w.since, w.until, byMonth)
	if !ok {
		return nil
	}

	start, ends, _, err := s.pieces(ctx, p, first, until)
	if err != nil {
		return err
	}

	f, ok := p.factor(start, ends)
	if !ok {
		return nil
	}

	inflation := domain.IndexFactor(monthly)
	if real, ok := domain.RealBP(f, inflation); ok {
		p.report.Inflation = &Inflation{
			Index:    index,
			From:     first,
			Until:    until,
			IndexBP:  domain.FactorBP(inflation),
			ReturnBP: domain.FactorBP(f),
			RealBP:   real,
		}
	}

	return nil
}
