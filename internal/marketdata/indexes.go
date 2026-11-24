package marketdata

import (
	"cmp"
	"context"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/index"
	"github.com/andrelopes-code/equori/internal/marketdata/index/brsgs"
	"github.com/andrelopes-code/equori/internal/marketdata/index/cpi"
	"github.com/andrelopes-code/equori/internal/marketdata/index/overnight"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

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
		{
			"br_cdi",
			sgs,
			5,
			func(hc *http.Client, url string) index.Source { return brsgs.CDI(hc, url) },
		},
		{
			"br_ipca",
			"https://apisidra.ibge.gov.br",
			20,
			func(hc *http.Client, url string) index.Source { return cpi.IPCA(hc, url) },
		},
		{
			"br_selic",
			sgs,
			5,
			func(hc *http.Client, url string) index.Source { return brsgs.Selic(hc, url) },
		},
		{
			"br_igpm",
			sgs,
			20,
			func(hc *http.Client, url string) index.Source { return brsgs.IGPM(hc, url) },
		},
		{
			"br_ptax_usd",
			sgs,
			5,
			func(hc *http.Client, url string) index.Source { return brsgs.Dollar(hc, url) },
		},
		{
			"eu_estr",
			"https://data-api.ecb.europa.eu",
			5,
			func(hc *http.Client, url string) index.Source { return overnight.ESTR(hc, url) },
		},
		{
			"ea_hicp",
			"https://ec.europa.eu",
			25,
			func(hc *http.Client, url string) index.Source { return cpi.HICP(hc, url) },
		},
		{
			"us_sofr",
			"https://markets.newyorkfed.org",
			5,
			func(hc *http.Client, url string) index.Source { return overnight.SOFR(hc, url) },
		},
		{
			"us_cpi",
			"https://api.bls.gov",
			20,
			func(hc *http.Client, url string) index.Source { return cpi.CPIU(hc, url) },
		},
	}
}

// businessDayIndexes lists the index of every registered source that compounds by business day,
// enabled or not, so that enabling a source never changes how stored terms accrue.
func businessDayIndexes() domain.BusinessDayIndexes {
	var out domain.BusinessDayIndexes

	for _, e := range indexEntries() {
		s := e.build(nil, e.defaultURL)
		if c, ok := s.(index.BusinessDayCompounding); ok && c.CompoundsByBusinessDay() {
			out = append(out, s.Index())
		}
	}

	slices.Sort(out)

	return out
}

// IndexSourceIDs lists the identifiers of the index sources.
func IndexSourceIDs() []string {
	entries := indexEntries()

	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}

	return ids
}

// NewIndexSources builds the index sources named by ids; urls overrides a source's base URL.
func NewIndexSources(
	ids []string,
	urls map[string]string,
	hc *http.Client,
) ([]index.Source, error) {
	byID := make(map[string]indexEntry)
	for _, e := range indexEntries() {
		byID[e.id] = e
	}

	out := make([]index.Source, 0, len(ids))
	for _, id := range ids {
		e, ok := byID[id]
		if !ok {
			return nil, fmt.Errorf("unknown index feed %q", id)
		}

		url := urls[id]
		if url == "" {
			url = e.defaultURL
		}

		out = append(out, e.build(hc, url))
	}

	return out, nil
}

// Indexes lists the enabled indexes with at least one stored rate: those suggested for the
// caller's region first (ADR 025 F3), each part in the order of the registry.
func (m *Module) Indexes(ctx context.Context) ([]IndexSummary, error) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return nil, err
	}

	l, err := m.profiles.Profile(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return nil, err
	}

	suggested := SuggestedFeeds(l.Region)
	expected := m.expectedIndexes(on)
	srcs := slices.Clone(m.feeds.Indexes)
	slices.SortStableFunc(srcs, func(a, b index.Source) int {
		return cmp.Compare(rank(suggested, a.ID()), rank(suggested, b.ID()))
	})

	out := []IndexSummary{}
	for _, src := range srcs {
		if !on[src.ID()] {
			continue
		}

		r, err := m.q.IndexRange(ctx, src.Index())
		if err != nil {
			return nil, fmt.Errorf("read the range of %s: %w", src.Index(), err)
		}

		if r.N > 0 {
			out = append(
				out,
				IndexSummary{
					ID:       src.Index(),
					Period:   src.Period(),
					First:    r.First,
					Last:     r.Last,
					Expected: slices.Contains(expected, src.Index()),
				},
			)
		}
	}

	return out, nil
}

// IndexRates returns the stored rates of an enabled index in [from, to], oldest first.
func (m *Module) IndexRates(
	ctx context.Context,
	id string,
	from, to time.Time,
) ([]IndexRate, error) {
	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return nil, err
	}

	if !slices.ContainsFunc(
		m.feeds.Indexes,
		func(s index.Source) bool { return s.Index() == id && on[s.ID()] },
	) {
		return nil, domain.ErrUnknownIndex
	}

	if err := domain.ValidIndexRange(from, to); err != nil {
		return nil, err
	}

	rows, err := m.q.ListIndexRatesBetween(
		ctx,
		postgres.ListIndexRatesBetweenParams{IndexID: id, FromDate: from, ToDate: to},
	)
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

func rank(suggested []string, id string) int {
	if slices.Contains(suggested, id) {
		return 0
	}

	return 1
}
