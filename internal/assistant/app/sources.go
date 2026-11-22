package app

import (
	"encoding/json"
	"net/url"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
	pview "github.com/andrelopes-code/equori/internal/platform/view"
)

// sourcesForm is the view of the pages an answer cites (web search design, S7).
const sourcesForm = "sources"

// maxSources is the most pages a view of sources lists.
const maxSources = 12

// Catalog keys of the view of sources.
const (
	sourcesTitleKey   = "assistantView.sources.title"
	sourcesVerdictKey = "assistantView.sources.verdict"
	sourcesNameHead   = "assistantView.sources.source"
	sourcesAddrHead   = "assistantView.sources.address"
)

// WebSource is a page of the web an answer cites.
type WebSource struct {
	URL   string `json:"url"`
	Title string `json:"title"`
}

// sourcesView builds the view of the pages an answer cites: each http or https address once,
// named by its title or, without one, by its host. Without such a page it returns no view.
func sourcesView(sources []WebSource, now time.Time) domain.View {
	kept := make([]WebSource, 0, len(sources))

	for _, s := range sources {
		u, err := url.Parse(s.URL)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			continue
		}

		if s.Title == "" {
			s.Title = u.Host
		}

		seen := slices.ContainsFunc(kept, func(k WebSource) bool { return k.URL == s.URL })
		if !seen && len(kept) < maxSources {
			kept = append(kept, s)
		}
	}

	if len(kept) == 0 {
		return domain.View{}
	}

	rows := make([][]pview.Value, len(kept))
	for i, s := range kept {
		rows[i] = []pview.Value{pview.TextValue(s.Title), pview.TextValue(s.URL)}
	}

	payload, err := json.Marshal(pview.Payload{
		Title: pview.Text{Key: sourcesTitleKey},
		Verdict: pview.Text{
			Key:    sourcesVerdictKey,
			Params: map[string]pview.Value{"count": pview.CountValue(int64(len(kept)))},
		},
		Next: []string{},
		Rows: pview.Table{Head: []string{sourcesNameHead, sourcesAddrHead}, Rows: rows},
		Data: map[string]any{"sources": kept},
	})
	if err != nil {
		return domain.View{}
	}

	return domain.View{ID: uuid.New(), Form: sourcesForm, Payload: payload, CreatedAt: now}
}
