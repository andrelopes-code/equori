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
	// failed is set when one of them failed, or was not asked for every date: nothing is recorded.
	failed bool
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

	for _, src := range sources {
		err = errors.Join(
			err,
			m.askYears(ctx, src, holes),
			m.askDays(ctx, src, holes, today),
		)
	}

	m.holesChecked = today

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
	years := make(map[string]int)
	for _, e := range sourceEntries() {
		years[e.id] = max(e.historyYears, e.baseYears)
	}

	ids := make([]string, len(sources))
	now := m.feeds.Clock.Now()
	today := m.feeds.Clock.Today(ctx)

	for i, src := range sources {
		ids[i] = src.ID()

		codes, err := m.baseCodes(ctx, src, ins)
		if err != nil {
			return false, err
		}

		for _, code := range codes {
			if err := m.q.RequestHistory(ctx, postgres.RequestHistoryParams{
				Source:      src.ID(),
				Instrument:  string(code),
				FromDate:    today.AddDate(-years[src.ID()], 0, 0),
				RequestedAt: now,
			}); err != nil {
				return false, fmt.Errorf("request the history of %s: %w", code, err)
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

// recordHoles records the sessions that every source answered without a price (A265 PH5).
func (m *Module) recordHoles(ctx context.Context, holes []*pairHoles) error {
	for _, h := range holes {
		if h.failed {
			continue
		}

		for _, d := range h.dates {
			if err := m.q.RecordPriceHole(ctx, postgres.RecordPriceHoleParams{
				Instrument:      string(h.instrument.Code),
				QuoteInstrument: string(h.quote),
				Date:            d,
			}); err != nil {
				return fmt.Errorf("record the hole of %s: %w", h.instrument.Code, err)
			}
		}
	}

	return nil
}

// missingPrices is the number of recorded holes of in that still have no price (A265 PH6).
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
