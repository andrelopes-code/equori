package llm

import "strings"

type FinishReason string

const (
	FinishStop      FinishReason = "stop"
	FinishLength    FinishReason = "length"
	FinishToolCalls FinishReason = "tool_calls"
	FinishBlocked   FinishReason = "blocked"
	FinishOther     FinishReason = "other"
)

type Usage struct {
	InputTokens  int
	OutputTokens int
}

type Response struct {
	Message      Message
	FinishReason FinishReason
	Usage        Usage
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
