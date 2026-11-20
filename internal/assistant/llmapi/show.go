package llmapi

import (
	"encoding/json"
	"strings"

	"github.com/andrelopes-code/equori/internal/assistant/app"
	"github.com/andrelopes-code/equori/internal/platform/llm"
)

const showName = "show"

const showDescription = "Presents an earlier read of this turn as a view the app draws: a chart, a table or a " +
	"list built from that read's output, so its figures are exact. Pass source, the view_source handle of the " +
	"read (two handles of one tool for compare and changes; up to four pages of one search for txs, " +
	"outliers and heat), and form, one of the forms of that tool. " +
	"Call it when the answer has a figure, a comparison, a share, a trend, a schedule or a list of records; " +
	"then write only what the view does not show. next holds up to 3 short follow-up questions in the " +
	"member's language. At most 3 views per answer. Forms by read tool:\n"

// showSchema is the arguments of show (answer views design, V2).
const showSchema = `{"type":"object","additionalProperties":false,"required":["source","form"],` +
	`"properties":{` +
	`"source":{"type":"array","minItems":1,"maxItems":4,"items":{"type":"string","pattern":"^r[0-9]{1,2}$"}},` +
	`"form":{"type":"string","pattern":"^[a-z][a-z0-9_]{1,39}$"},` +
	`"select":{"type":"object","additionalProperties":false,"properties":{` +
	`"limit":{"type":"integer","minimum":1,"maximum":12},"highlight":{"type":"string","maxLength":80}}},` +
	`"next":{"type":"array","maxItems":3,"items":{"type":"string","minLength":1,"maxLength":60}}}}`

// showDecl declares show with the forms each declared read tool has in the registry.
func showDecl(svc *app.Service, decls []llm.Tool) llm.Tool {
	var lines []string
	for _, d := range decls {
		if forms := svc.FormsOf(d.Name); len(forms) > 0 {
			lines = append(lines, "- "+d.Name+": "+strings.Join(forms, ", "))
		}
	}

	return llm.Tool{
		Name:        showName,
		Description: showDescription + strings.Join(lines, "\n"),
		Parameters:  json.RawMessage(showSchema),
	}
}
