package postgres_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

var t0 = time.Date(2026, 10, 23, 10, 0, 0, 0, time.UTC)

func conversation(t *testing.T, repo *postgres.Repository, userID int64, at time.Time) domain.Conversation {
	t.Helper()
	c := domain.Conversation{ID: uuid.New(), Title: "T", CreatedAt: at, UpdatedAt: at}
	if err := repo.CreateConversation(t.Context(), userID, c); err != nil {
		t.Fatal(err)
	}
	return c
}

func TestConversation(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	repo := postgres.NewRepository(pool)
	ctx := t.Context()
	a, b := pgtest.CreateUser(t, pool), pgtest.CreateUser(t, pool)
	c1 := conversation(t, repo, a, t0)
	c2 := conversation(t, repo, a, t0.Add(time.Hour))
	c3 := conversation(t, repo, a, t0.Add(2*time.Hour))

	var last time.Time
	for i, role := range []domain.Role{domain.RoleUser, domain.RoleAssistant, domain.RoleUser} {
		m := domain.Message{ID: uuid.New(), ConversationID: c1.ID, Role: role, Content: "x", CreatedAt: t0.Add(time.Duration(i+1) * time.Minute)}
		if role == domain.RoleAssistant {
			m.Outcome = domain.OutcomeAnswered
		}
		got, err := repo.AppendMessage(ctx, a, m)
		if err != nil || got.Seq != i+1 || got.Outcome != m.Outcome {
			t.Fatalf("AppendMessage = %+v, %v; want seq %d", got, err, i+1)
		}
		last = m.CreatedAt
	}
	msgs, err := repo.Messages(ctx, a, c1.ID)
	if err != nil || len(msgs) != 3 || msgs[0].Seq != 1 || msgs[2].Seq != 3 || msgs[1].Role != domain.RoleAssistant {
		t.Fatalf("Messages = %+v, %v", msgs, err)
	}
	if got, err := repo.Conversation(ctx, a, c1.ID); err != nil || !got.UpdatedAt.Equal(last) {
		t.Fatalf("Conversation = %+v, %v; want updated_at %v", got, err, last)
	}

	// c1 was touched at t0+3m, which is older than c2 and c3.
	page, err := repo.Conversations(ctx, a, nil, 2)
	if err != nil || len(page) != 2 || page[0].ID != c3.ID || page[1].ID != c2.ID {
		t.Fatalf("first page = %+v, %v", page, err)
	}
	next, err := repo.Conversations(ctx, a, &app.ConversationKey{UpdatedAt: page[1].UpdatedAt, ID: page[1].ID}, 2)
	if err != nil || len(next) != 1 || next[0].ID != c1.ID {
		t.Fatalf("next page = %+v, %v", next, err)
	}

	if _, err := repo.Conversation(ctx, b, c1.ID); !errors.Is(err, domain.ErrConversationNotFound) {
		t.Fatalf("other user's Conversation error = %v", err)
	}
	if err := repo.DeleteConversation(ctx, b, c1.ID); !errors.Is(err, domain.ErrConversationNotFound) {
		t.Fatalf("other user's DeleteConversation error = %v", err)
	}
	if err := repo.DeleteConversations(ctx, b); err != nil {
		t.Fatal(err)
	}
	if all, _ := repo.Conversations(ctx, a, nil, 10); len(all) != 3 {
		t.Fatalf("user A has %d conversations, want 3", len(all))
	}
}
