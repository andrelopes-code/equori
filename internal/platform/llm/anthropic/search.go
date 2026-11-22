package anthropic

import (
	"encoding/json"
	"slices"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// The search Anthropic runs on its servers (web search design, S3): the version without code
// execution, which every platform that offers the tool serves.
const (
	searchToolType = "web_search_20250305"
	searchToolName = "web_search"
	searchMaxUses  = 3
)

// searchTool declares the provider's search; it carries no schema.
type searchTool struct {
	Type    string `json:"type"`
	Name    string `json:"name"`
	MaxUses int    `json:"max_uses"`
}

// citation is the page a text block cites.
type citation struct {
	URL   string `json:"url"`
	Title string `json:"title"`
}

type serverToolUse struct {
	WebSearchRequests int `json:"web_search_requests"`
}

// readSearch adds to resp the query of a search block and the pages a text block cites, each
// address once (web search design, S4).
func readSearch(resp *llm.Response, b contentBlock) {
	if b.Type == blockServerToolUse && b.Name == searchToolName {
		var in struct {
			Query string `json:"query"`
		}

		if json.Unmarshal(b.Input, &in) == nil && in.Query != "" {
			resp.Searches = append(resp.Searches, in.Query)
		}
	}

	for _, c := range b.Citations {
		s := llm.Source{URL: c.URL, Title: c.Title}
		if c.URL != "" && !slices.ContainsFunc(resp.Sources, func(o llm.Source) bool {
			return o.URL == s.URL
		}) {
			resp.Sources = append(resp.Sources, s)
		}
	}
}
