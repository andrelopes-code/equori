package toolapi

import (
	"time"

	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

// currentView states that market values took current quotes (A248 CQ26).
type currentView struct {
	Count    int    `json:"count"     jsonschema:"prices that are current quotes"`
	Open     bool   `json:"open"      jsonschema:"a trading session still runs: the values are partial"`
	OldestAt string `json:"oldest_at" jsonschema:"the earliest instant among them, RFC 3339"`
}

func currentOf(c *app.CurrentQuotes) currentView {
	if c == nil {
		return currentView{}
	}

	return currentView{Count: c.Count, Open: c.Open, OldestAt: c.OldestAt.Format(time.RFC3339)}
}
