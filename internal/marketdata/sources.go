package marketdata

import (
	"net/http"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed/b3cotahist"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed/bcbptax"
)

// LegacySources builds the sources selected by the boolean feed settings. The feed registry replaces it.
func LegacySources(ptax, cotahist bool, ptaxURL, cotahistURL string, hc *http.Client) []feed.Source {
	var out []feed.Source
	if ptax {
		out = append(out, bcbptax.New(hc, ptaxURL))
	}
	if cotahist {
		out = append(out, b3cotahist.New(hc, cotahistURL))
	}
	return out
}
