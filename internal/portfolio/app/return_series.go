package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// ErrInvalidSeriesRange: from is after to, the step is unknown, or the period holds more than
// domain.MaxSeriesSteps step dates.
var ErrInvalidSeriesRange = errors.New("invalid series range")

type SeriesPoint struct {
	Date     time.Time
	Value    int64
	Flows    int64
	ReturnBP *int
}

type IndexPoint struct {
	Date     time.Time
	ReturnBP int
}

type IndexSeries struct {
	Index  string
	Period string // "day" or "month"
	Points []IndexPoint
}

type ReturnSeries struct {
	From, To time.Time
	Currency money.Currency
	Opening  int64
	Points   []SeriesPoint
	Indexes  []IndexSeries
}

// ReturnSeries is the value, the flows and the cumulative time-weighted return of the tree at each
// step date of [from, to]; the zero from is the first posting of the tree (portfolio results PS1
// to PS6).
func (s *Service) ReturnSeries(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	from, to time.Time,
	in money.Currency,
	step string,
) (ReturnSeries, error) {
	ids, err := s.treeIDs(ctx, booksID, accountID)
	if err != nil {
		return ReturnSeries{}, err
	}

	if from.IsZero() {
		if from, err = s.firstPostingOr(ctx, booksID, ids, to); err != nil {
			return ReturnSeries{}, err
		}
	}

	steps, ok := domain.StepDates(from, to, step)
	if !ok {
		return ReturnSeries{}, ErrInvalidSeriesRange
	}

	report, err := s.treeMoney(ctx, booksID, ids, from, to, in)
	if err != nil {
		return ReturnSeries{}, err
	}

	p, index, rates, err := s.periodOf(ctx, booksID, ids, from, to, "", &report)
	if err != nil {
		return ReturnSeries{}, err
	}

	p.cuts = steps

	start, subs, dates, err := s.pieces(ctx, p, from, to)
	if err != nil {
		return ReturnSeries{}, err
	}

	indexes, err := s.seriesIndexes(ctx, p, index, rates, steps)
	if err != nil {
		return ReturnSeries{}, err
	}

	return ReturnSeries{
		From:     from,
		To:       to,
		Currency: report.Opening.Currency(),
		Opening:  start,
		Points:   seriesPoints(p, steps, start, subs, dates),
		Indexes:  indexes,
	}, nil
}

// firstPostingOr is the first posting of the tree, or fallback when it has none or it is later.
func (s *Service) firstPostingOr(
	ctx context.Context,
	booksID int64,
	ids []uuid.UUID,
	fallback time.Time,
) (time.Time, error) {
	first, found, err := s.ledger.FirstPosting(ctx, booksID, ids)
	if err != nil {
		return time.Time{}, err
	}

	if !found || first.After(fallback) {
		return fallback, nil
	}

	return first, nil
}

// seriesPoints gives one point per step date: the value at the end of the day, the flows of the
// pieces since the previous point and the factor of every piece up to the date. Every step date is
// the end date of a piece.
func seriesPoints(
	p period,
	steps []time.Time,
	start int64,
	subs []domain.Subperiod,
	dates []time.Time,
) []SeriesPoint {
	points := make([]SeriesPoint, len(steps))
	j := 0

	for i, step := range steps {
		var flows int64

		for ; j < len(dates) && !dates[j].After(step); j++ {
			flows += subs[j].Flow
		}

		points[i] = SeriesPoint{Date: step, Value: subs[j-1].Value, Flows: flows}

		if f, ok := p.factor(start, subs[:j]); ok {
			points[i].ReturnBP = new(domain.FactorBP(f))
		}
	}

	return points
}
