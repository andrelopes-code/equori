package app_test

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

func turns(n, userBytes, answerBytes int) []domain.Message {
	var out []domain.Message
	for range n {
		out = append(out,
			domain.Message{ID: uuid.New(), Role: domain.RoleUser, Content: strings.Repeat("u", userBytes)},
			domain.Message{ID: uuid.New(), Role: domain.RoleAssistant, Content: strings.Repeat("a", answerBytes)})
	}
	return out
}

func TestHistory(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	t.Run("at most 6 turns", func(t *testing.T) {
		t.Parallel()
		if got := len(app.History(turns(8, 250, 250), nil, now)); got != 12 {
			t.Fatalf("messages = %d, want 12", got)
		}
	})
	t.Run("at most 8000 bytes, a turn that does not fit is dropped", func(t *testing.T) {
		t.Parallel()
		if got := len(app.History(turns(3, 1500, 1500), nil, now)); got != 4 {
			t.Fatalf("messages = %d, want 4", got)
		}
	})
	t.Run("proposal lines", func(t *testing.T) {
		t.Parallel()
		msgs := turns(1, 5, 5)
		executed, pending := uuid.New(), uuid.New()
		answer := msgs[1].ID
		got := app.History(msgs, []domain.Proposal{
			{ID: executed, MessageID: answer, Tool: "record_transaction", Status: domain.ProposalExecuted, ExpiresAt: now.Add(time.Hour)},
			{ID: pending, MessageID: answer, Tool: "void_transaction", Status: domain.ProposalPending, ExpiresAt: now.Add(-time.Minute)},
		}, now)
		want := "aaaaa" + fmt.Sprintf("\n[proposal %s record_transaction: executed]\n[proposal %s void_transaction: expired]", executed, pending)
		if len(got) != 2 || got[1].Role != domain.RoleAssistant || got[1].Text != want {
			t.Fatalf("history = %+v, want assistant text %q", got, want)
		}
	})
	t.Run("failed and canceled exchanges", func(t *testing.T) {
		t.Parallel()
		msgs := turns(2, 3, 3)
		msgs[1].Content, msgs[1].Outcome = "", domain.OutcomeFailed
		msgs[3].Content, msgs[3].Outcome = "", domain.OutcomeCanceled
		got := app.History(msgs, nil, now)
		if len(got) != 4 || got[1].Text != app.NoAnswer || got[3].Text != app.NoAnswer {
			t.Fatalf("history = %+v, want 4 messages with %q answers", got, app.NoAnswer)
		}
	})
}
