package app

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

const maxBookOutput = 12 * 1024

var bookTools = []string{"list_accounts", "list_schedules"}

// bookReads calls the turn-start reads of spec 2026-11-03 §8 and replaces an output that is too
// long or a failed call by a line that names the tool.
func (s *Service) bookReads(ctx context.Context, booksID int64) []BookRead {
	ctx = auth.WithBooksID(ctx, booksID)
	reads := make([]BookRead, 0, len(bookTools))

	for _, name := range bookTools {
		res, err := s.tools.Call(ctx, name, json.RawMessage("{}"))

		text := string(res.Content)
		if err != nil || res.IsError {
			text = fmt.Sprintf("(unavailable; call %s)", name)
		} else if len(res.Content) > maxBookOutput {
			text = fmt.Sprintf("(too long; call %s)", name)
		}

		reads = append(reads, BookRead{Tool: name, Text: text})
	}

	return reads
}
