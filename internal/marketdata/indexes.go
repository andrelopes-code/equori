package marketdata

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/index"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/index/brsgs"
)

// indexWindowDays bounds one fetch: the SGS refuses a daily series over ten years, and five years
// leave room.
const indexWindowDays = 1825

type indexEntry struct {
	id         string
	defaultURL string
	build      func(hc *http.Client, url string) index.Source
}

func indexEntries() []indexEntry {
	const sgs = "https://api.bcb.gov.br"
	return []indexEntry{
		{"br_cdi", sgs, func(hc *http.Client, url string) index.Source { return brsgs.CDI(hc, url) }},
		{"br_ipca", sgs, func(hc *http.Client, url string) index.Source { return brsgs.IPCA(hc, url) }},
	}
}

// IndexSourceIDs lists the identifiers accepted in EQUORI_INDEX_FEEDS.
func IndexSourceIDs() []string {
	entries := indexEntries()
	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}
	return ids
}

// NewIndexSources builds the index sources named by ids; urls overrides a source's base URL.
func NewIndexSources(ids []string, urls map[string]string, hc *http.Client) ([]index.Source, error) {
	byID := make(map[string]indexEntry)
	for _, e := range indexEntries() {
		byID[e.id] = e
	}
	out := make([]index.Source, 0, len(ids))
	for _, id := range ids {
		e, ok := byID[id]
		if !ok {
			return nil, fmt.Errorf("EQUORI_INDEX_FEEDS: unknown index feed %q", id)
		}
		url := urls[id]
		if url == "" {
			url = e.defaultURL
		}
		out = append(out, e.build(hc, url))
	}
	return out, nil
}

// TickIndexes fetches, for each index some security follows, the rates from the day after the
// latest stored one (from the earliest issue date for a first fetch) to today. A failure is
// logged; the next tick fetches the same days again.
func (m *Module) TickIndexes(ctx context.Context) {
	for _, src := range m.feeds.Indexes {
		if err := m.tickIndex(ctx, src); err != nil {
			m.logFeed(ctx, err, "source", src.ID())
		}
	}
}

func (m *Module) tickIndex(ctx context.Context, src index.Source) error {
	followed := src.Index()
	issued, err := m.q.IndexTermsStart(ctx, &followed)
	if err != nil {
		return err
	}
	if issued.N == 0 {
		return nil
	}
	latest, err := m.q.LatestIndexRate(ctx, src.Index())
	if err != nil {
		return err
	}
	from := issued.IssuedOn
	if latest.Found && latest.Latest.AddDate(0, 0, 1).After(from) {
		from = latest.Latest.AddDate(0, 0, 1)
	}
	today := m.feeds.Clock.Today()
	for !from.After(today) {
		to := from.AddDate(0, 0, indexWindowDays)
		if to.After(today) {
			to = today
		}
		rates, err := src.Fetch(ctx, from, to)
		if storeErr := m.storeRates(ctx, src, rates); err == nil {
			err = storeErr
		}
		if err != nil {
			return err
		}
		from = to.AddDate(0, 0, 1)
	}
	return nil
}

func (m *Module) storeRates(ctx context.Context, src index.Source, rates []index.Rate) error {
	for _, r := range rates {
		var value pgtype.Numeric
		if err := value.Scan(r.Value); err != nil {
			return fmt.Errorf("rate of %s: %w", r.Date.Format(time.DateOnly), err)
		}
		if err := m.q.UpsertIndexRate(ctx, postgres.UpsertIndexRateParams{IndexID: src.Index(), Date: r.Date, Rate: value, Source: src.ID()}); err != nil {
			return fmt.Errorf("store the rate of %s: %w", r.Date.Format(time.DateOnly), err)
		}
	}
	return nil
}
