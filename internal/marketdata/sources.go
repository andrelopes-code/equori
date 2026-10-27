package marketdata

import (
	"fmt"
	"net/http"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed/b3cotahist"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed/bcbptax"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed/ecb"
)

type sourceEntry struct {
	id         string
	defaultURL string
	// lag is the number of calendar days after a day by which its prices are due (ADR 025 F9).
	lag   int
	build func(hc *http.Client, url string) feed.Source
}

func sourceEntries() []sourceEntry {
	return []sourceEntry{
		{"b3_cotahist", "https://bvmf.bmfbovespa.com.br/InstDados/SerHist", 5, func(hc *http.Client, url string) feed.Source { return b3cotahist.New(hc, url) }},
		{"bcb_ptax", "https://olinda.bcb.gov.br/olinda/service/PTAX/version/v1/odata", 5, func(hc *http.Client, url string) feed.Source { return bcbptax.New(hc, url) }},
		{"ecb", "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml", 5, func(hc *http.Client, url string) feed.Source { return ecb.New(hc, url) }},
	}
}

// SourceIDs lists the identifiers accepted in EQUORI_PRICE_FEEDS.
func SourceIDs() []string {
	entries := sourceEntries()
	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}
	return ids
}

// NewSources builds the sources named by ids; urls overrides a source's default base URL.
func NewSources(ids []string, urls map[string]string, hc *http.Client) ([]feed.Source, error) {
	byID := make(map[string]sourceEntry)
	for _, e := range sourceEntries() {
		byID[e.id] = e
	}
	out := make([]feed.Source, 0, len(ids))
	for _, id := range ids {
		e, ok := byID[id]
		if !ok {
			return nil, fmt.Errorf("EQUORI_PRICE_FEEDS: unknown feed %q", id)
		}
		url := urls[id]
		if url == "" {
			url = e.defaultURL
		}
		out = append(out, e.build(hc, url))
	}
	return out, nil
}
