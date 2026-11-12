package marketdata

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// historyJob is a pending row of marketdata_history that needs a fetch up to end.
type historyJob struct {
	row  postgres.MarketdataHistory
	code money.Currency
	end  time.Time
}

// tickHistory runs the pending rows of src (A222 MQ9; plan decisions D6 to D9).
func (m *Module) tickHistory(ctx context.Context, src feed.Source) error {
	rows, err := m.q.ListPendingHistory(ctx, src.ID())
	if err != nil {
		return fmt.Errorf("list the pending history of %s: %w", src.ID(), err)
	}

	if len(rows) == 0 {
		return nil
	}

	all, err := m.ListInstruments(ctx, "")
	if err != nil {
		return err
	}

	quoted := src.Codes(feedInstruments(all))
	today := m.feeds.Clock.Today(ctx)

	var jobs []historyJob

	for _, row := range rows {
		code := money.Currency(row.Instrument)
		if !slices.Contains(quoted, code) {
			m.finishHistory(ctx, row, "")
			continue
		}

		earliest, err := m.q.EarliestSourceDate(
			ctx,
			postgres.EarliestSourceDateParams{Source: src.ID(), Instrument: row.Instrument},
		)
		if err != nil {
			return fmt.Errorf("read the earliest price of %s from %s: %w", code, src.ID(), err)
		}

		end := earliest.AddDate(0, 0, -1)
		if end.After(today) {
			end = today
		}

		if row.FromDate.After(end) {
			m.finishHistory(ctx, row, "")
			continue
		}

		jobs = append(jobs, historyJob{row: row, code: code, end: end})
	}

	return m.fetchHistory(ctx, src, jobs)
}

// fetchHistory makes one Fetch of src over the jobs and finishes each row (D6 to D9).
func (m *Module) fetchHistory(ctx context.Context, src feed.Source, jobs []historyJob) error {
	if len(jobs) == 0 {
		return nil
	}

	from, to := jobs[0].row.FromDate, jobs[0].end
	codes := make([]money.Currency, len(jobs))

	for i, j := range jobs {
		codes[i] = j.code
		from = slices.MinFunc([]time.Time{from, j.row.FromDate}, time.Time.Compare)
		to = slices.MaxFunc([]time.Time{to, j.end}, time.Time.Compare)
	}

	quotes, err := src.Fetch(ctx, codes, from, to)
	m.logFetchError(ctx, src.ID(), err)

	failures := historyFailures(err, codes)

	store := quotesOfRows(quotes, codes, failures)
	if storeErr := m.storeQuotes(ctx, src.ID(), store); storeErr != nil {
		m.logFeed(ctx, storeErr, "source", src.ID())

		for _, code := range codes {
			failures[code] = storeErr.Error()
		}

		err = errors.Join(err, storeErr)
	}

	for _, j := range jobs {
		m.finishHistory(ctx, j.row, failures[j.code])
	}

	return err
}

// finishHistory marks row done, or failed with text; it matches the request read at the start
// of the run, so a request that lowered from_date meanwhile keeps the row pending (D9).
func (m *Module) finishHistory(ctx context.Context, row postgres.MarketdataHistory, text string) {
	arg := postgres.FinishHistoryParams{
		Source:      row.Source,
		Instrument:  row.Instrument,
		RequestedAt: row.RequestedAt,
	}

	if text == "" {
		now := m.feeds.Clock.Now()
		arg.DoneAt = &now
	} else {
		arg.Error = &text
	}

	if err := m.q.FinishHistory(ctx, arg); err != nil {
		m.logFeed(
			ctx,
			fmt.Errorf("finish the history of %s from %s: %w", row.Instrument, row.Source, err),
		)
	}
}

// historyFailures maps each code of a failed row to the text of its failure: a ScopeError with
// Key instrument fails its code, any other error fails every code (D7).
func historyFailures(err error, codes []money.Currency) map[money.Currency]string {
	failures := make(map[money.Currency]string)
	other := ""

	for _, leaf := range leaves(err) {
		var scope *feed.ScopeError
		if errors.As(leaf, &scope) && scope.Key == "instrument" &&
			slices.Contains(codes, money.Currency(scope.Value)) {
			failures[money.Currency(scope.Value)] = scope.Err.Error()
			continue
		}

		if other == "" {
			other = leaf.Error()
		}
	}

	if other != "" {
		for _, code := range codes {
			if _, ok := failures[code]; !ok {
				failures[code] = other
			}
		}
	}

	return failures
}

// leaves flattens the errors joined by errors.Join.
func leaves(err error) []error {
	if err == nil {
		return nil
	}

	joined, ok := err.(interface{ Unwrap() []error })
	if !ok {
		return []error{err}
	}

	var out []error
	for _, e := range joined.Unwrap() {
		out = append(out, leaves(e)...)
	}

	return out
}

// quotesOfRows keeps the quotes of the rows that did not fail: a quote belongs to the row of
// its instrument when that code is in the fetch, otherwise to the row of its quote (D8).
func quotesOfRows(
	quotes []feed.Quote,
	codes []money.Currency,
	failures map[money.Currency]string,
) []feed.Quote {
	var out []feed.Quote

	for _, q := range quotes {
		owner := q.Instrument
		if !slices.Contains(codes, owner) {
			owner = q.Quote
		}

		if _, failed := failures[owner]; !failed {
			out = append(out, q)
		}
	}

	return out
}
