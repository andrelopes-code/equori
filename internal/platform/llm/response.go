package llm

import "strings"

type FinishReason string

const (
	FinishStop      FinishReason = "stop"
	FinishLength    FinishReason = "length"
	FinishToolCalls FinishReason = "tool_calls"
	FinishBlocked   FinishReason = "blocked"
	FinishOther     FinishReason = "other"
	// FinishPaused: the provider stopped a long turn of its own tools; sending the
	// conversation again continues it (web search design, S5).
	FinishPaused FinishReason = "paused"
)

type Usage struct {
	InputTokens  int
	OutputTokens int
	// WebSearches counts the searches the provider ran and bills (web search design, S4).
	WebSearches int
}

// Source is a page of the web an answer cites.
type Source struct {
	URL   string
	Title string
}

type Response struct {
	Message      Message
	FinishReason FinishReason
	Usage        Usage
	// Searches holds the query of each search the provider ran for this response, and Sources
	// the pages its text cites, each address once (web search design, S4).
	Searches []string
	Sources  []Source
	// Target is the model that answered, set by Client.
	Target Target
}

// Text concatenates the text parts of the answer.
func (r Response) Text() string {
	var b strings.Builder
	for _, p := range r.Message.Parts {
		if p.ToolCall == nil && p.ToolResult == nil {
			b.WriteString(p.Text)
		}
	}

	return b.String()
}

// Target is one model of one provider.
type Target struct {
	Provider string
	Model    string
}

func (t Target) String() string { return t.Provider + "/" + t.Model }
