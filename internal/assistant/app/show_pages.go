package app

import (
	"context"
	"encoding/json"
)

// maxChartPages bounds the pages a chart reads after the ones the model passed (answer views
// design, V39).
const maxChartPages = 100

// followPages reads the pages that follow the last handle of a chart, with the arguments of
// that read and the cursor of each page (V39). It stops at the last page, at maxChartPages or
// at a page that fails; the chart then refuses an output that still names a next page (V29).
func (s *Service) followPages(
	ctx context.Context,
	t *turnState,
	handles []string,
	outputs []json.RawMessage,
) []json.RawMessage {
	r, ok := t.readOf(handles[len(handles)-1])
	if !ok {
		return outputs
	}

	var args map[string]json.RawMessage
	if json.Unmarshal(r.args, &args) != nil || args == nil {
		args = map[string]json.RawMessage{}
	}

	for range maxChartPages {
		cursor := nextCursor(outputs[len(outputs)-1])
		if cursor == nil {
			break
		}

		args["cursor"] = cursor

		raw, err := json.Marshal(args)
		if err != nil {
			break
		}

		res, err := s.tools.Call(ctx, r.tool, raw)
		if err != nil || res.IsError {
			break
		}

		outputs = append(outputs, res.Content)
	}

	return outputs
}

// nextCursor is the next_cursor of a page as JSON; nil on the last page.
func nextCursor(out json.RawMessage) json.RawMessage {
	var page struct {
		Next string `json:"next_cursor"`
	}

	if json.Unmarshal(out, &page) != nil || page.Next == "" {
		return nil
	}

	cursor, _ := json.Marshal(page.Next)

	return cursor
}
