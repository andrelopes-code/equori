package marketdata

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// WarmCurrent asks the enabled sources for the current quote of each code and of the quote
// currency of each code, and waits at most CurrentBound. A failure is logged and kept as the
// state of its source; it is never returned (A248 CQ12 to CQ14, CQ18).
func (m *Module) WarmCurrent(ctx context.Context, codes []money.Currency) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		m.logFeed(ctx, err)
		return
	}

	list, err := m.ListInstruments(ctx, "")
	if err != nil {
		m.logFeed(ctx, err)
		return
	}

	var (
		ins   = feedInstruments(spotNeeded(list, codes))
		now   = m.feeds.Clock.Now()
		waits []<-chan struct{}
	)

	for _, src := range m.feeds.Sources {
		spot, ok := src.(feed.Spot)
		if !ok || !on[src.ID()] {
			continue
		}

		claim := m.spot.claim(src.ID(), ins, now)

		waits = append(waits, claim.wait...)
		if len(claim.ask) > 0 {
			waits = append(waits, claim.done)

			m.askCurrent(src.ID(), spot, claim)
		}
	}

	m.waitCurrent(ctx, waits)
}

// ConvertCurrent values q in currency to now: the path of Convert at today, where a leg takes
// the current quote of its pair when one is fresh and later than the chosen close (A248 CQ16,
// CQ17).
func (m *Module) ConvertCurrent(
	ctx context.Context,
	q money.Money,
	to money.Currency,
) (Conversion, error) {
	return m.convert(ctx, q, to, m.feeds.Clock.Today(ctx), m.currentLeg)
}

func (m *Module) currentLeg(
	ctx context.Context,
	from, to money.Currency,
	date time.Time,
) (money.Leg, Price, bool, error) {
	leg, p, ok, err := m.leg(ctx, from, to, date)
	if err != nil {
		return leg, p, ok, err
	}

	e, source, inverse, found := m.spot.fresh(from, to, m.feeds.Clock.Now(), m.unofficial)
	if !found || (ok && !e.quote.Date.After(p.Date)) {
		return leg, p, ok, nil
	}

	price := Price{
		Instrument: e.quote.Instrument,
		Quote:      e.quote.Quote,
		Date:       e.quote.Date,
		Value:      e.quote.Value,
		Source:     source,
		At:         &e.quote.At,
		Open:       e.quote.Open,
	}

	return money.Leg{Rate: e.quote.Value, Inverse: inverse}, price, true, nil
}

// askCurrent runs Current of src on the life of the module; the outcome goes to the cache.
func (m *Module) askCurrent(id string, src feed.Spot, claim spotClaim) {
	m.refreshes.Go(func() {
		quotes, err := src.Current(m.life, claim.ask)
		if err != nil {
			m.logFeed(m.life, err, "source", id)
		}

		m.spot.finish(id, claim, quotes, err, m.feeds.Clock.Now())
	})
}

// waitCurrent returns when every channel of waits is closed, CurrentBound passes or ctx ends.
func (m *Module) waitCurrent(ctx context.Context, waits []<-chan struct{}) {
	ctx, cancel := context.WithTimeout(ctx, m.feeds.CurrentBound)
	defer cancel()

	for _, w := range waits {
		select {
		case <-w:
		case <-ctx.Done():
			return
		}
	}
}

// spotNeeded keeps the instruments of codes and the instruments those codes are quoted in.
func spotNeeded(list []Instrument, codes []money.Currency) []Instrument {
	quoted := make(map[money.Currency]money.Currency, len(list))
	for _, in := range list {
		quoted[in.Code] = in.QuoteCurrency
	}

	want := make(map[money.Currency]bool, 2*len(codes))
	for _, c := range codes {
		want[c], want[quoted[c]] = true, true
	}

	var out []Instrument

	for _, in := range list {
		if want[in.Code] {
			out = append(out, in)
		}
	}

	return out
}
