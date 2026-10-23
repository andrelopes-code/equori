package postgres_test

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func newProposal(t *testing.T, repo *postgres.Repository, userID int64, conv uuid.UUID) domain.Proposal {
	t.Helper()
	p := domain.Proposal{
		ID: uuid.New(), ConversationID: conv, Tool: "create_transaction", Arguments: []byte(`{}`), Preview: []byte(`{}`),
		Basis: strings.Repeat("a", 64), Status: domain.ProposalPending, CreatedAt: t0, ExpiresAt: t0.Add(domain.ProposalTTL),
	}
	if err := repo.InsertProposal(t.Context(), userID, p); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestProposal(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	repo := postgres.NewRepository(pool)
	ctx := t.Context()
	a, b := pgtest.CreateUser(t, pool), pgtest.CreateUser(t, pool)
	c := conversation(t, repo, a, t0)

	p := newProposal(t, repo, a, c.ID)
	if got, ok, err := repo.ClaimProposal(ctx, b, p.ID, t0); err != nil || ok || got.ID != uuid.Nil {
		t.Fatalf("other user's claim = %+v, %v, %v", got, ok, err)
	}
	if got, ok, err := repo.ClaimProposal(ctx, a, p.ID, t0.Add(time.Minute)); err != nil || !ok || got.Status != domain.ProposalExecuting {
		t.Fatalf("first claim = %+v, %v, %v", got, ok, err)
	}
	if _, ok, err := repo.ClaimProposal(ctx, a, p.ID, t0.Add(time.Minute)); err != nil || ok {
		t.Fatalf("second claim = %v, %v", ok, err)
	}
	if ok, err := repo.RejectProposal(ctx, a, p.ID, t0.Add(time.Minute)); err != nil || ok {
		t.Fatalf("reject of executing = %v, %v", ok, err)
	}
	if err := repo.DecideProposal(ctx, a, p.ID, domain.ProposalExecuted, []byte(`{"ok":true}`), t0.Add(2*time.Minute)); err != nil {
		t.Fatal(err)
	}
	got, err := repo.Proposal(ctx, a, p.ID)
	if err != nil || got.Status != domain.ProposalExecuted || string(got.Result) != `{"ok": true}` || !got.DecidedAt.Equal(t0.Add(2*time.Minute)) {
		t.Fatalf("Proposal = %+v, %v", got, err)
	}

	expiring := newProposal(t, repo, a, c.ID)
	if _, ok, err := repo.ClaimProposal(ctx, a, expiring.ID, expiring.ExpiresAt); err != nil || ok {
		t.Fatalf("claim at expires_at = %v, %v", ok, err)
	}
	if ok, err := repo.RejectProposal(ctx, a, expiring.ID, expiring.ExpiresAt); err != nil || ok {
		t.Fatalf("reject at expires_at = %v, %v", ok, err)
	}

	rejectable, discardable := newProposal(t, repo, a, c.ID), newProposal(t, repo, a, c.ID)
	if ok, err := repo.RejectProposal(ctx, a, rejectable.ID, t0); err != nil || !ok {
		t.Fatalf("reject = %v, %v", ok, err)
	}
	if err := repo.DiscardProposals(ctx, a, []uuid.UUID{p.ID, rejectable.ID, discardable.ID}, t0.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	want := map[uuid.UUID]domain.ProposalStatus{p.ID: domain.ProposalExecuted, rejectable.ID: domain.ProposalRejected, discardable.ID: domain.ProposalDiscarded}
	for id, status := range want {
		if got, _ := repo.Proposal(ctx, a, id); got.Status != status {
			t.Errorf("proposal %s status = %s, want %s", id, got.Status, status)
		}
	}

	msg, err := repo.AppendMessage(ctx, a, domain.Message{ID: uuid.New(), ConversationID: c.ID, Role: domain.RoleAssistant, Outcome: domain.OutcomeAnswered, CreatedAt: t0})
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.AttachProposals(ctx, a, msg.ID, []uuid.UUID{p.ID}); err != nil {
		t.Fatal(err)
	}
	if got, _ := repo.Proposal(ctx, a, p.ID); got.MessageID != msg.ID {
		t.Fatalf("MessageID = %s, want %s", got.MessageID, msg.ID)
	}
	if list, err := repo.Proposals(ctx, a, c.ID); err != nil || len(list) != 4 {
		t.Fatalf("Proposals = %d, %v; want 4", len(list), err)
	}
	if _, err := repo.Proposal(ctx, b, p.ID); err == nil {
		t.Fatal("other user read the proposal")
	}

	if err := repo.DeleteConversation(ctx, a, c.ID); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM assistant_proposal`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("%d proposals kept after the conversation was deleted (%v)", n, err)
	}
}
