package marketdata

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// historyJob is a pending row of marketdata_history that needs a fetch up to end.
type historyJob struct {
	row  postgres.MarketdataHistory
	code money.Currency
	end  time.Time
}

// requestHistory queues, for each source of sources, the codes it quotes among ins from the
// start that from gives, and asks for a tick when it queued a row (A222 MQ5, MQ10). It returns
// the number of rows requested.
func (m *Module) requestHistory(ctx context.Context, sources []feed.Source, ins []feed.Instrument, from func(source string) time.Time) (int, error) {
	if len(sources) == 0 {
		return 0, nil
	}

	now := m.feeds.Clock.Now()
	n := 0

	for _, src := range sources {
		start := from(src.ID())

		for _, code := range src.Codes(ins) {
			err := m.q.RequestHistory(ctx, postgres.RequestHistoryParams{
				Source:      src.ID(),
				Instrument:  string(code),
				FromDate:    start,
				RequestedAt: now,
			})
			if err != nil {
				return n, fmt.Errorf("request the history of %s from %s: %w", code, src.ID(), err)
			}

			n++
		}
	}

	if n > 0 {
		m.requestTick()
	}

	return n, nil
}

// requestDefaultHistory requests the default history of in from every enabled source that
// quotes it; a failure is logged, the operation that called it still succeeds (D11).
func (m *Module) requestDefaultHistory(ctx context.Context, in Instrument) {
	sources, err := m.enabledSources(ctx)
	if err == nil {
		_, err = m.requestHistory(ctx, sources, feedInstruments([]Instrument{in}), m.defaultStart(ctx))
	}

	if err != nil {
		m.logFeed(ctx, err, "instrument", string(in.Code))
	}
}

// defaultStart is today minus the history years of the source's entry (A222 MQ6).
func (m *Module) defaultStart(ctx context.Context) func(source string) time.Time {
	years := make(map[string]int)
	for _, e := range sourceEntries() {
		years[e.id] = e.historyYears
	}

	return func(source string) time.Time {
		return m.feeds.Clock.Today(ctx).AddDate(-years[source], 0, 0)
	}
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

		earliest, err := m.q.EarliestSourceDate(ctx, postgres.EarliestSourceDateParams{Source: src.ID(), Instrument: row.Instrument})
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
	arg := postgres.FinishHistoryParams{Source: row.Source, Instrument: row.Instrument, RequestedAt: row.RequestedAt}

	if text == "" {
		now := m.feeds.Clock.Now()
		arg.DoneAt = &now
	} else {
		arg.Error = &text
	}

	if err := m.q.FinishHistory(ctx, arg); err != nil {
		m.logFeed(ctx, fmt.Errorf("finish the history of %s from %s: %w", row.Instrument, row.Source, err))
	}
}

// requestTick asks RunFeeds for a tick: now when none runs, or once more after the running one
// (A222 MQ10).
func (m *Module) requestTick() {
	m.again.Store(true)
	m.wake()
}

// wake sends on kick without blocking; one pending wake-up is enough.
func (m *Module) wake() {
	select {
	case m.kick <- struct{}{}:
	default:
	}
}

// enabledSources returns the price sources the stored settings enable.
func (m *Module) enabledSources(ctx context.Context) ([]feed.Source, error) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return nil, err
	}

	var out []feed.Source

	for _, src := range m.feeds.Sources {
		if on[src.ID()] {
			out = append(out, src)
		}
	}

	return out, nil
}

func feedInstruments(list []Instrument) []feed.Instrument {
	ins := make([]feed.Instrument, len(list))
	for i, in := range list {
		ins[i] = feed.Instrument{Code: in.Code, Type: in.Type, Exchange: in.Exchange, QuoteCurrency: in.QuoteCurrency}
	}

	return ins
}

// historyFailures maps each code of a failed row to the text of its failure: a ScopeError with
// Key instrument fails its code, any other error fails every code (D7).
func historyFailures(err error, codes []money.Currency) map[money.Currency]string {
	failures := make(map[money.Currency]string)
	other := ""

	for _, leaf := range leaves(err) {
		var scope *feed.ScopeError
		if errors.As(leaf, &scope) && scope.Key == "instrument" && slices.Contains(codes, money.Currency(scope.Value)) {
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
func quotesOfRows(quotes []feed.Quote, codes []money.Currency, failures map[money.Currency]string) []feed.Quote {
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

// requestFeedHistory requests the default history of every instrument from the price source id,
// when it is one; a failure is logged, enabling the feed still succeeds (D11).
func (m *Module) requestFeedHistory(ctx context.Context, id string) {
	i := slices.IndexFunc(m.feeds.Sources, func(s feed.Source) bool { return s.ID() == id })
	if i < 0 {
		return
	}

	list, err := m.ListInstruments(ctx, "")
	if err == nil {
		_, err = m.requestHistory(ctx, m.feeds.Sources[i:i+1], feedInstruments(list), m.defaultStart(ctx))
	}

	if err != nil {
		m.logFeed(ctx, err, "source", id)
	}
}
