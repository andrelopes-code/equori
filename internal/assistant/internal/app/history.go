package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

const (
	HistoryBytes = 8000
	HistoryTurns = 6
	NoAnswer     = "[no answer]" // text of a failed or canceled answer (design 2026-10-26 E12)
)

// HistoryMessage is one earlier message sent to the model as text.
type HistoryMessage struct {
	Role domain.Role
	Text string
}

// History applies spec 5.3: the latest turns that fit HistoryBytes, at most HistoryTurns, oldest first. A turn is
// a user message with its answer; a user message without an answer is left out. Each proposal of an answer
// adds a line with its status at now.
func History(messages []domain.Message, proposals []domain.Proposal, now time.Time) []HistoryMessage {
	var turns [][2]HistoryMessage
	for i := 0; i+1 < len(messages); i++ {
		u, a := messages[i], messages[i+1]
		if u.Role != domain.RoleUser || a.Role != domain.RoleAssistant {
			continue
		}
		text := a.Content
		if a.Outcome == domain.OutcomeFailed || a.Outcome == domain.OutcomeCanceled {
			text = NoAnswer
		}
		for _, p := range proposals {
			if p.MessageID != a.ID {
				continue
			}
			status := string(p.Status)
			if p.Expired(now) {
				status = "expired"
			}
			text += fmt.Sprintf("\n[proposal %s %s: %s]", p.ID, p.Tool, status)
		}
		if strings.TrimSpace(text) == "" {
			continue
		}
		turns = append(turns, [2]HistoryMessage{{domain.RoleUser, u.Content}, {domain.RoleAssistant, text}})
	}
	size, from := 0, len(turns)
	for from > 0 && len(turns)-from < HistoryTurns {
		n := len(turns[from-1][0].Text) + len(turns[from-1][1].Text)
		if size+n > HistoryBytes {
			break
		}
		size += n
		from--
	}
	out := make([]HistoryMessage, 0, 2*(len(turns)-from))
	for _, t := range turns[from:] {
		out = append(out, t[0], t[1])
	}
	return out
}
