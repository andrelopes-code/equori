package app

import (
	"context"
	"errors"
	"maps"
	"slices"
	"sync"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// riskWorkers is the number of dates addRiskMarks values at once: each holds one connection of
// the pool, and a book with years of monthly trades has hundreds of flow dates.
const riskWorkers = 4

// addRiskMarks values every holding at the end of each flow date of the portfolio inside a
// month, before its last day (RK5): the pieces of every holding then cover the same days.
func (s *Service) addRiskMarks(
	ctx context.Context,
	booksID int64,
	book riskBook,
	in money.Currency,
	out *riskInputs,
) error {
	type mark struct {
		month int
		date  time.Time
	}

	var marks []mark

	for i := range out.ends {
		for _, date := range out.flowDates(i) {
			marks = append(marks, mark{month: i, date: date})
		}
	}

	values := make([]map[string]holdingMonth, len(marks))
	errs := make([]error, len(marks))
	slots := make(chan struct{}, riskWorkers)

	var wg sync.WaitGroup

	for k, m := range marks {
		wg.Add(1)

		slots <- struct{}{}

		go func() {
			defer wg.Done()
			defer func() { <-slots }()

			values[k], errs[k] = s.riskMonth(ctx, booksID, book, m.date, in)
		}()
	}

	wg.Wait()

	if err := errors.Join(errs...); err != nil {
		return err
	}

	for k, m := range marks {
		for holding, h := range out.holdings {
			v := values[k][holding]
			h.months[m.month].Marks = append(h.months[m.month].Marks, domain.Mark{
				Date:  m.date,
				Value: v.value,
				Known: v.state != domain.MonthMissing,
			})
		}
	}

	return nil
}

// flowDates are the distinct dates of the flows of month i of every holding, before the month's
// last day, sorted.
func (r *riskInputs) flowDates(i int) []time.Time {
	set := map[time.Time]bool{}

	for _, h := range r.holdings {
		for _, f := range h.months[i].Flows {
			if f.Date.Before(r.ends[i]) {
				set[f.Date] = true
			}
		}
	}

	return slices.SortedFunc(maps.Keys(set), time.Time.Compare)
}
