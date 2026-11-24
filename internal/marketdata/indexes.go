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
	"github.com/andrelopes-code/equori/internal/marketdata/index/brb3"
	"github.com/andrelopes-code/equori/internal/marketdata/index/brsgs"
	"github.com/andrelopes-code/equori/internal/marketdata/index/cpi"
	"github.com/andrelopes-code/equori/internal/marketdata/index/overnight"
	"github.com/andrelopes-code/equori/internal/marketdata/index/totalreturn"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// IndexKindMarket is the kind of an index that no contract pays (A265 MI6).
const IndexKindMarket = index.KindMarket

type indexEntry struct {
	id         string
	defaultURL string
	// lag is the number of calendar days after the end of a period by which the rate of a monthly
	// index is due (ADR 025 F9); a daily one is due by its business days (A265 RI5).
	lag   int
	build func(hc *http.Client, url string, now func() time.Time) index.Source
	// unofficial is true for a source that publishes no terms for this use (A222 MQ1, A265 MI5).
	unofficial bool
}

func indexEntries() []indexEntry {
	const (
		sgs   = "https://api.bcb.gov.br"
		b3    = "https://sistemaswebb3-listados.b3.com.br"
		yahoo = "https://query1.finance.yahoo.com/v8/finance/chart"
	)

	return []indexEntry{
		{
			id:         "br_cdi",
			defaultURL: sgs,
			lag:        5,
			build: func(hc *http.Client, url string, _ func() time.Time) index.Source {
				return brsgs.CDI(hc, url)
			},
		},
		{
			id:         "br_ipca",
			defaultURL: "https://apisidra.ibge.gov.br",
			lag:        20,
			build: func(hc *http.Client, url string, _ func() time.Time) index.Source {
				return cpi.IPCA(hc, url)
			},
		},
		{
			id:         "br_selic",
			defaultURL: sgs,
			lag:        5,
			build: func(hc *http.Client, url string, _ func() time.Time) index.Source {
				return brsgs.Selic(hc, url)
			},
		},
		{
			id:         "br_igpm",
			defaultURL: sgs,
			lag:        20,
			build: func(hc *http.Client, url string, _ func() time.Time) index.Source {
				return brsgs.IGPM(hc, url)
			},
		},
		{
			id:         "br_ptax_usd",
			defaultURL: sgs,
			lag:        5,
			build: func(hc *http.Client, url string, _ func() time.Time) index.Source {
				return brsgs.Dollar(hc, url)
			},
		},
		{
			id:         "eu_estr",
			defaultURL: "https://data-api.ecb.europa.eu",
			lag:        5,
			build: func(hc *http.Client, url string, _ func() time.Time) index.Source {
				return overnight.ESTR(hc, url)
			},
		},
		{
			id:         "ea_hicp",
			defaultURL: "https://ec.europa.eu",
			lag:        25,
			build: func(hc *http.Client, url string, _ func() time.Time) index.Source {
				return cpi.HICP(hc, url)
			},
		},
		{
			id:         "us_sofr",
			defaultURL: "https://markets.newyorkfed.org",
			lag:        5,
			build: func(hc *http.Client, url string, _ func() time.Time) index.Source {
				return overnight.SOFR(hc, url)
			},
		},
		{
			id:         "us_cpi",
			defaultURL: "https://api.bls.gov",
			lag:        20,
			build: func(hc *http.Client, url string, _ func() time.Time) index.Source {
				return cpi.CPIU(hc, url)
			},
		},
		{
			id:         "br_ibovespa",
			defaultURL: b3,
			build: func(hc *http.Client, url string, now func() time.Time) index.Source {
				return brb3.Ibovespa(hc, url, now)
			},
		},
		{
			id:         "br_ifix",
			defaultURL: b3,
			build: func(hc *http.Client, url string, now func() time.Time) index.Source {
				return brb3.IFIX(hc, url, now)
			},
		},
		{
			id:         "us_sp500",
			defaultURL: yahoo,
			build: func(hc *http.Client, url string, now func() time.Time) index.Source {
				return totalreturn.SP500(hc, url, now)
			},
			unofficial: true,
		},
		{
			id:         "global_ftse",
			defaultURL: yahoo,
			build: func(hc *http.Client, url string, now func() time.Time) index.Source {
				return totalreturn.FTSEGlobal(hc, url, now)
			},
			unofficial: true,
		},
	}
}

// businessDayIndexes lists the index of every registered source that compounds by business day,
// enabled or not, so that enabling a source never changes how stored terms accrue.
func businessDayIndexes() domain.BusinessDayIndexes {
	var out domain.BusinessDayIndexes

	for _, e := range indexEntries() {
		s := e.build(nil, e.defaultURL, nil)
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
	now func() time.Time,
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

		out = append(out, e.build(hc, url, now))
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
					Kind:     index.KindOf(src),
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
