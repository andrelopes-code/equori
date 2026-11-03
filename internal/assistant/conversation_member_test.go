package assistant_test

import (
	"encoding/json"
	"net/http"
	"strconv"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/assistant/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

// S198: a conversation and its proposals are reachable only by the member that owns them.
func TestConversationOfOneMember(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	h := e.h
	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")
	conv := storeConversation(t, e, h.OwnerID(), h.MemberIDOf("owner@example.com"))

	content, err := assistant.ProposeForTest(h.App.Assistant, t.Context(), h.OwnerID(), conv.ID, "note_for_test", json.RawMessage(`{"text":"x"}`), app.ProposalMeta{})
	if err != nil {
		t.Fatal(err)
	}

	var out struct {
		ProposalID string `json:"proposal_id"`
	}
	if err := json.Unmarshal(content, &out); err != nil || out.ProposalID == "" {
		t.Fatalf("proposal = %s, %v", content, err)
	}

	base := "/api/v1/assistant/conversations"

	var list conversationList

	r := h.Call(writer, http.MethodGet, base, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("writer list status %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &list)

	if len(list.Items) != 0 {
		t.Fatalf("writer sees %d conversations, want 0", len(list.Items))
	}

	h.ExpectProblem(h.Call(writer, http.MethodGet, base+"/"+conv.ID.String(), nil), http.StatusNotFound, "conversation_not_found", "")
	h.ExpectProblem(h.Call(writer, http.MethodDelete, base+"/"+conv.ID.String(), nil), http.StatusNotFound, "conversation_not_found", "")

	if r := h.Call(writer, http.MethodDelete, base, nil); r.Status != http.StatusNoContent {
		t.Fatalf("writer delete all status %d: %s", r.Status, r.Body)
	}

	r = h.Call(h.Client, http.MethodGet, base, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("owner list status %d: %s", r.Status, r.Body)
	}

	list = conversationList{}
	r.Decode(t, &list)

	if len(list.Items) != 1 {
		t.Fatalf("owner sees %d conversations, want 1", len(list.Items))
	}

	for _, action := range []string{"confirm", "reject"} {
		r := h.Call(writer, http.MethodPost, "/api/v1/assistant/proposals/"+out.ProposalID+"/"+action, nil)
		h.ExpectProblem(r, http.StatusNotFound, "proposal_not_found", "")
	}

	if r := h.Call(h.Client, http.MethodGet, base+"/"+conv.ID.String(), nil); r.Status != http.StatusOK {
		t.Fatalf("owner detail status %d: %s", r.Status, r.Body)
	}
}

// HA22: removing a membership deletes the conversations of that member in the book.
func TestRemovedMemberLosesConversations(t *testing.T) {
	t.Parallel()
	e := newProposalEnv(t)
	h := e.h
	h.JoinAs("writer@example.com", h.OwnerID(), "write")
	writerID := h.MemberIDOf("writer@example.com")
	storeConversation(t, e, h.OwnerID(), writerID)

	r := h.Call(h.Client, http.MethodDelete, "/api/v1/books/current/members/"+strconv.FormatInt(writerID, 10), nil)
	if r.Status != http.StatusNoContent {
		t.Fatalf("remove member status %d: %s", r.Status, r.Body)
	}

	var n int
	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM assistant_conversation WHERE member_id = $1`, writerID).Scan(&n); err != nil || n != 0 {
		t.Fatalf("%d conversations kept after the member was removed (%v)", n, err)
	}
}

func storeConversation(t *testing.T, e proposalEnv, booksID, memberID int64) domain.Conversation {
	t.Helper()

	conv := domain.Conversation{ID: uuid.New(), Title: "t", CreatedAt: *e.now.Load(), UpdatedAt: *e.now.Load()}
	if err := postgres.NewRepository(e.h.Pool).CreateConversation(t.Context(), booksID, memberID, conv); err != nil {
		t.Fatal(err)
	}

	return conv
}
