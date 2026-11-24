package marketdata

import (
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/b3consolidated"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/b3cotahist"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/b3pricereport"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/bcbptax"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/coinbase"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/cvmfunds"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/ecb"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/tesourodireto"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/yahoochart"
)

type sourceEntry struct {
	id         string
	defaultURL string
	// lag is the number of calendar days after a day by which its prices are due (ADR 025 F9).
	lag int
	// official is false for a source that publishes no terms for this use (A222 MQ1).
	official bool
	// historyYears is how far back enabling the source, or defining an instrument it quotes,
	// requests prices (A222 MQ6); 0 for a source that fills holes alone.
	historyYears int
	// baseYears is how far back the daily check requests prices when that is more: the year files
	// of the B3 are read for every instrument at once (A265 PH2).
	baseYears int
	// yearsOf is the source whose year files this one reads, empty for none.
	yearsOf string
	// build receives the URL of every source, the override or the default.
	build func(hc *http.Client, urls map[string]string, now func() time.Time) feed.Source
}

func sourceEntries() []sourceEntry {
	return []sourceEntry{
		{
			id:           "b3_cotahist",
			defaultURL:   "https://bvmf.bmfbovespa.com.br/InstDados/SerHist",
			lag:          5,
			official:     true,
			historyYears: 5,
			baseYears:    indexHistoryYears,
			build: func(hc *http.Client, urls map[string]string, _ func() time.Time) feed.Source {
				return b3cotahist.New(hc, urls["b3_cotahist"])
			},
		},
		{
			id:           "b3_consolidated",
			defaultURL:   "https://arquivos.b3.com.br",
			lag:          5,
			official:     true,
			historyYears: 5,
			baseYears:    indexHistoryYears,
			yearsOf:      "b3_cotahist",
			build: func(hc *http.Client, urls map[string]string, _ func() time.Time) feed.Source {
				return b3consolidated.New(
					hc,
					urls["b3_consolidated"],
					b3cotahist.New(hc, urls["b3_cotahist"]),
				)
			},
		},
		{
			id:         "b3_price_report",
			defaultURL: "https://www.b3.com.br",
			lag:        5,
			official:   true,
			build: func(hc *http.Client, urls map[string]string, _ func() time.Time) feed.Source {
				return b3pricereport.New(hc, urls["b3_price_report"])
			},
		},
		{
			id:           "bcb_ptax",
			defaultURL:   "https://olinda.bcb.gov.br/olinda/service/PTAX/version/v1/odata",
			lag:          5,
			official:     true,
			historyYears: indexHistoryYears,
			build: func(hc *http.Client, urls map[string]string, _ func() time.Time) feed.Source {
				return bcbptax.New(hc, urls["bcb_ptax"])
			},
		},
		{
			id:           "ecb",
			defaultURL:   "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml",
			lag:          5,
			official:     true,
			historyYears: indexHistoryYears,
			build: func(hc *http.Client, urls map[string]string, _ func() time.Time) feed.Source {
				return ecb.New(hc, urls["ecb"])
			},
		},
		{
			id:           "tesouro_direto",
			defaultURL:   "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv",
			lag:          5,
			official:     true,
			historyYears: indexHistoryYears,
			build: func(hc *http.Client, urls map[string]string, _ func() time.Time) feed.Source {
				return tesourodireto.New(hc, urls["tesouro_direto"])
			},
		},
		{
			id:           "cvm_funds",
			defaultURL:   "https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS",
			lag:          10,
			official:     true,
			historyYears: 5,
			build: func(hc *http.Client, urls map[string]string, _ func() time.Time) feed.Source {
				return cvmfunds.New(hc, urls["cvm_funds"])
			},
		},
		{
			id:           "coinbase",
			defaultURL:   "https://api.coinbase.com/api/v3/brokerage/market",
			lag:          2,
			official:     true,
			historyYears: indexHistoryYears,
			build: func(hc *http.Client, urls map[string]string, now func() time.Time) feed.Source {
				return coinbase.New(hc, urls["coinbase"], now)
			},
		},
		{
			id:           "yahoo_chart",
			defaultURL:   "https://query1.finance.yahoo.com/v8/finance/chart",
			lag:          5,
			official:     false,
			historyYears: indexHistoryYears,
			build: func(hc *http.Client, urls map[string]string, now func() time.Time) feed.Source {
				return yahoochart.New(hc, urls["yahoo_chart"], now)
			},
		},
	}
}

// unofficialSources lists, sorted, the sources whose prices rank last (A222 MQ2).
func unofficialSources() domain.UnofficialSources {
	var out domain.UnofficialSources

	for _, e := range sourceEntries() {
		if !e.official {
			out = append(out, e.id)
		}
	}

	slices.Sort(out)

	return out
}

// SourceIDs lists the identifiers of the price sources.
func SourceIDs() []string {
	entries := sourceEntries()

	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}

	return ids
}

// NewSources builds the sources named by ids; urls overrides a source's default base URL.
func NewSources(
	ids []string,
	urls map[string]string,
	hc *http.Client,
	now func() time.Time,
) ([]feed.Source, error) {
	byID := make(map[string]sourceEntry)
	for _, e := range sourceEntries() {
		byID[e.id] = e
	}

	all := make(map[string]string, len(byID))
	for id, e := range byID {
		all[id] = e.defaultURL
		if urls[id] != "" {
			all[id] = urls[id]
		}
	}

	out := make([]feed.Source, 0, len(ids))
	for _, id := range ids {
		e, ok := byID[id]
		if !ok {
			return nil, fmt.Errorf("unknown price feed %q", id)
		}

		out = append(out, e.build(hc, all, now))
	}

	return out, nil
}
