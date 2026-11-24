package marketdata

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// holeAgeDays is the age of a session from which a missing price is a hole: every source published
// it by then (A265 PH3).
const holeAgeDays = 7

// pairHoles are the sessions without a price of one instrument in one quote currency.
type pairHoles struct {
	instrument feed.Instrument
	quote      money.Currency
	dates      []time.Time
	// sources are the enabled sources that ever quoted the pair.
	sources []string
	// failed is set when one of them failed: no date is recorded but those of noTrade.
	failed bool
	// waiting are the days a source with daily files did not answer: they are asked by the next tick.
	waiting []time.Time
	// noTrade are the sessions a witnessed source states to be without a trade.
	noTrade []time.Time
}

// tickHoles looks, once a day, for the sessions without a price of each instrument and asks every
// enabled source that quotes it (A265 PH2 to PH5). It waits for the history requests no tick ran
// yet: they fetch most of what is missing.
func (m *Module) tickHoles(ctx context.Context) error {
	today := m.feeds.Clock.Today(ctx)
	if m.holesChecked.Equal(today) {
		return nil
	}

	sources, err := m.enabledSources(ctx)
	if err != nil || len(sources) == 0 {
		return err
	}

	list, err := m.ListInstruments(ctx, "")
	if err != nil {
		return err
	}

	ins, err := m.withSessions(ctx, feedInstruments(list))
	if err != nil {
		return err
	}

	fresh, err := m.requestBaseHistory(ctx, sources, ins)
	if err != nil || fresh {
		return err
	}

	holes, err := m.priceHoles(ctx, sources, ins, today)
	if err != nil {
		return err
	}

	for _, src := range withoutShared(sources) {
		err = errors.Join(err, m.askYears(ctx, src, holes))
	}

	for _, src := range sources {
		err = errors.Join(err, m.askDays(ctx, src, holes))
	}

	if !slices.ContainsFunc(holes, func(h *pairHoles) bool { return len(h.waiting) > 0 }) {
		m.holesChecked = today
	}

	return errors.Join(err, m.recordHoles(ctx, holes))
}

// withSessions keeps the instruments whose sessions are stored.
func (m *Module) withSessions(
	ctx context.Context,
	ins []feed.Instrument,
) ([]feed.Instrument, error) {
	stored := make(map[string]bool)

	var out []feed.Instrument

	for _, in := range ins {
		index, _ := sessionIndex(in)
		if index == "" {
			continue
		}

		if _, ok := stored[index]; !ok {
			latest, err := m.q.LatestIndexRate(ctx, index)
			if err != nil {
				return nil, fmt.Errorf("read the latest rate of %s: %w", index, err)
			}

			stored[index] = latest.Found
		}

		if stored[index] {
			out = append(out, in)
		}
	}

	return out, nil
}

// requestBaseHistory requests the base history of every code of every source and reports whether a
// request no tick ran yet remains; it then asks for a tick (A265 PH2).
func (m *Module) requestBaseHistory(
	ctx context.Context,
	sources []feed.Source,
	ins []feed.Instrument,
) (bool, error) {
	ids := make([]string, len(sources))
	for i, src := range sources {
		ids[i] = src.ID()
	}

	for _, src := range withoutShared(sources) {
		codes, err := m.baseCodes(ctx, src, ins)
		if err != nil {
			return false, err
		}

		for _, code := range codes {
			if err := m.requestBase(ctx, src.ID(), code); err != nil {
				return false, err
			}
		}
	}

	fresh, err := m.q.CountFreshHistory(ctx, ids)
	if err != nil || fresh == 0 {
		return false, err
	}

	m.requestTick()

	return true, nil
}

// requestBase requests the base history of code from source: 20 years, and from a source with year
// files no earlier than the year before the first price of any source, the year it was listed in.
func (m *Module) requestBase(ctx context.Context, source string, code money.Currency) error {
	entries := sourceEntries()
	e := entries[slices.IndexFunc(entries, func(e sourceEntry) bool { return e.id == source })]

	years := max(e.historyYears, e.baseYears)
	if years == 0 {
		return nil
	}

	from := m.feeds.Clock.Today(ctx).AddDate(-years, 0, 0)

	if e.baseYears > 0 {
		first, err := m.q.FirstQuotedDate(ctx, string(code))
		if err != nil {
			return fmt.Errorf("read the first price of %s: %w", code, err)
		}

		if listed := first.AddDate(-1, 0, 0); listed.After(from) {
			from = listed
		}
	}

	err := m.q.RequestHistory(ctx, postgres.RequestHistoryParams{
		Source:      source,
		Instrument:  string(code),
		FromDate:    from,
		RequestedAt: m.feeds.Clock.Now(),
	})
	if err != nil {
		return fmt.Errorf("request the history of %s: %w", code, err)
	}

	return nil
}

// withoutShared drops the sources that read the year files of another enabled one: they are read once.
func withoutShared(sources []feed.Source) []feed.Source {
	enabled := make(map[string]bool, len(sources))
	for _, src := range sources {
		enabled[src.ID()] = true
	}

	shared := make(map[string]string)
	for _, e := range sourceEntries() {
		shared[e.id] = e.yearsOf
	}

	return slices.DeleteFunc(slices.Clone(sources), func(src feed.Source) bool {
		return enabled[shared[src.ID()]]
	})
}

// baseCodes are the codes of ins that src quotes; a currency only when src stored it in the currency
// of its sessions, so that a source of other pairs is not read for it.
func (m *Module) baseCodes(
	ctx context.Context,
	src feed.Source,
	ins []feed.Instrument,
) ([]money.Currency, error) {
	var out []feed.Instrument

	for _, in := range ins {
		if in.Type != "currency" {
			out = append(out, in)
			continue
		}

		_, quote := sessionIndex(in)

		quoting, err := m.quotingSources(ctx, []feed.Source{src}, in, quote)
		if err != nil {
			return nil, err
		}

		if len(quoting) > 0 {
			out = append(out, in)
		}
	}

	return src.Codes(out), nil
}

// priceHoles lists the pairs with a hole that an enabled source can fill.
func (m *Module) priceHoles(
	ctx context.Context,
	sources []feed.Source,
	ins []feed.Instrument,
	today time.Time,
) ([]*pairHoles, error) {
	var out []*pairHoles

	for _, in := range ins {
		index, quote := sessionIndex(in)

		dates, err := m.q.ListPriceHoles(ctx, postgres.ListPriceHolesParams{
			Instrument:      string(in.Code),
			QuoteInstrument: string(quote),
			IndexID:         index,
			Until:           today.AddDate(0, 0, -holeAgeDays),
		})
		if err != nil {
			return nil, fmt.Errorf("list the holes of %s: %w", in.Code, err)
		}

		if len(dates) == 0 {
			continue
		}

		quoting, err := m.quotingSources(ctx, sources, in, quote)
		if err != nil {
			return nil, err
		}

		if len(quoting) > 0 {
			out = append(
				out,
				&pairHoles{instrument: in, quote: quote, dates: dates, sources: quoting},
			)
		}
	}

	return out, nil
}

// quotingSources are the enabled sources that quote in today and ever stored a price of the pair.
func (m *Module) quotingSources(
	ctx context.Context,
	sources []feed.Source,
	in feed.Instrument,
	quote money.Currency,
) ([]string, error) {
	stored, err := m.q.ListPairSources(
		ctx,
		postgres.ListPairSourcesParams{Instrument: string(in.Code), QuoteInstrument: string(quote)},
	)
	if err != nil {
		return nil, fmt.Errorf("list the sources of %s: %w", in.Code, err)
	}

	var out []string

	for _, src := range sources {
		if slices.Contains(stored, src.ID()) && len(src.Codes([]feed.Instrument{in})) > 0 {
			out = append(out, src.ID())
		}
	}

	return out, nil
}

// recordHoles records the sessions without a trade, and those that every source answered without a
// price (A265 PH5).
func (m *Module) recordHoles(ctx context.Context, holes []*pairHoles) error {
	for _, h := range holes {
		if err := m.recordHole(ctx, h, h.noTrade, true); err != nil {
			return err
		}

		if h.failed {
			continue
		}

		if err := m.recordHole(ctx, h, h.dates, false); err != nil {
			return err
		}
	}

	return nil
}

func (m *Module) recordHole(
	ctx context.Context,
	h *pairHoles,
	dates []time.Time,
	noTrade bool,
) error {
	for _, d := range dates {
		if slices.ContainsFunc(h.waiting, d.Equal) {
			continue
		}

		if err := m.q.RecordPriceHole(ctx, postgres.RecordPriceHoleParams{
			Instrument:      string(h.instrument.Code),
			QuoteInstrument: string(h.quote),
			Date:            d,
			NoTrade:         noTrade,
		}); err != nil {
			return fmt.Errorf("record the hole of %s: %w", h.instrument.Code, err)
		}
	}

	return nil
}

// missingPrices is the number of recorded holes of in that still have no price, the sessions without
// a trade left out (A265 PH6).
func (m *Module) missingPrices(ctx context.Context, in domain.Instrument) (int, error) {
	index, quote := sessionIndex(feedInstruments([]Instrument{in})[0])
	if index == "" {
		return 0, nil
	}

	n, err := m.q.CountPriceHoles(
		ctx,
		postgres.CountPriceHolesParams{Instrument: string(in.Code), QuoteInstrument: string(quote)},
	)
	if err != nil {
		return 0, fmt.Errorf("count the holes of %s: %w", in.Code, err)
	}

	return int(n), nil
}
