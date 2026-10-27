package marketdata

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/index"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/index/brsgs"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/index/cpi"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/index/overnight"
)

// indexWindowDays bounds one fetch: the SGS refuses a daily series over ten years, and five years
// leave room.
const indexWindowDays = 1825

// indexHistoryYears is how far back an enabled index is fetched (calculators design §6).
const indexHistoryYears = 20

type indexEntry struct {
	id         string
	defaultURL string
	// lag is the number of calendar days after the end of a period by which its rate is due
	// (ADR 025 F9).
	lag   int
	build func(hc *http.Client, url string) index.Source
}

func indexEntries() []indexEntry {
	const sgs = "https://api.bcb.gov.br"
	return []indexEntry{
		{"br_cdi", sgs, 5, func(hc *http.Client, url string) index.Source { return brsgs.CDI(hc, url) }},
		{"br_ipca", sgs, 20, func(hc *http.Client, url string) index.Source { return brsgs.IPCA(hc, url) }},
		{"eu_estr", "https://data-api.ecb.europa.eu", 5, func(hc *http.Client, url string) index.Source { return overnight.ESTR(hc, url) }},
		{"ea_hicp", "https://ec.europa.eu", 25, func(hc *http.Client, url string) index.Source { return cpi.HICP(hc, url) }},
		{"us_sofr", "https://markets.newyorkfed.org", 5, func(hc *http.Client, url string) index.Source { return overnight.SOFR(hc, url) }},
		{"us_cpi", "https://api.bls.gov", 20, func(hc *http.Client, url string) index.Source { return cpi.CPIU(hc, url) }},
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

// tickIndex fetches the rates of an index from the day after the latest stored one to today; a
// first fetch starts 20 years before today, or at the earliest issue date of a security that
// follows the index when that is earlier. On a failure the next tick fetches the same days again.
func (m *Module) tickIndex(ctx context.Context, src index.Source) error {
	followed := src.Index()
	issued, err := m.q.IndexTermsStart(ctx, &followed)
	if err != nil {
		return err
	}
	today := m.feeds.Clock.Today()
	from := today.AddDate(-indexHistoryYears, 0, 0)
	if issued.N > 0 && issued.IssuedOn.Before(from) {
		from = issued.IssuedOn
	}
	latest, err := m.q.LatestIndexRate(ctx, src.Index())
	if err != nil {
		return err
	}
	if latest.Found && latest.Latest.AddDate(0, 0, 1).After(from) {
		from = latest.Latest.AddDate(0, 0, 1)
	}
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

// Indexes lists the enabled indexes with at least one stored rate, in the order of the registry.
func (m *Module) Indexes(ctx context.Context) ([]IndexSummary, error) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return nil, err
	}
	out := []IndexSummary{}
	for _, src := range m.feeds.Indexes {
		if !on[src.ID()] {
			continue
		}
		r, err := m.q.IndexRange(ctx, src.Index())
		if err != nil {
			return nil, fmt.Errorf("read the range of %s: %w", src.Index(), err)
		}
		if r.N > 0 {
			out = append(out, IndexSummary{ID: src.Index(), Period: src.Period(), First: r.First, Last: r.Last})
		}
	}
	return out, nil
}

// IndexRates returns the stored rates of an enabled index in [from, to], oldest first.
func (m *Module) IndexRates(ctx context.Context, id string, from, to time.Time) ([]IndexRate, error) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return nil, err
	}
	if !slices.ContainsFunc(m.feeds.Indexes, func(s index.Source) bool { return s.Index() == id && on[s.ID()] }) {
		return nil, domain.ErrUnknownIndex
	}
	if err := domain.ValidIndexRange(from, to); err != nil {
		return nil, err
	}
	rows, err := m.q.ListIndexRatesBetween(ctx, postgres.ListIndexRatesBetweenParams{IndexID: id, FromDate: from, ToDate: to})
	if err != nil {
		return nil, fmt.Errorf("list the rates of %s: %w", id, err)
	}
	out := make([]IndexRate, len(rows))
	for i, r := range rows {
		v, err := r.Rate.Value()
		if err != nil {
			return nil, fmt.Errorf("rate of %s: %w", r.Date.Format(time.DateOnly), err)
		}
		out[i] = IndexRate{Date: r.Date, Rate: fmt.Sprint(v)}
	}
	return out, nil
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
