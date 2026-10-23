package assistant_test

import (
	"encoding/json"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

type conversationList struct {
	Items []struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	} `json:"items"`
	NextCursor string `json:"next_cursor"`
}

func newTurn(t *testing.T, h *apitest.Harness, c *http.Client, now *atomic.Int64, text string) string {
	t.Helper()
	now.Add(1)
	r := sendTurn(h, c, map[string]any{"text": text})
	var turn struct {
		ConversationID string `json:"conversation_id"`
	}
	if err := json.Unmarshal([]byte(parseSSE(r.Body)[0].Data), &turn); err != nil || turn.ConversationID == "" {
		t.Fatalf("turn = %s, %v", r.Body, err)
	}
	return turn.ConversationID
}

func conversationHarness(t *testing.T, replies int) (*apitest.Harness, *atomic.Int64) {
	t.Helper()
	steps := make([]llmtest.Step, replies)
	for i := range steps {
		steps[i] = textStep("ok")
	}
	var tick atomic.Int64
	start := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	h := apitest.New(t, apitest.LLM(llmtest.New("aistudio", steps...)),
		apitest.Clock(func() time.Time { return start.Add(time.Duration(tick.Load()) * time.Minute) }))
	return h, &tick
}

func TestConversationListAndDelete(t *testing.T) {
	t.Parallel()
	h, tick := conversationHarness(t, 2)
	first := newTurn(t, h, h.Client, tick, "primeira conversa")
	second := newTurn(t, h, h.Client, tick, "segunda conversa")
	var page conversationList
	h.MustDo(http.MethodGet, "/api/v1/assistant/conversations?limit=1", nil, http.StatusOK, &page)
	if len(page.Items) != 1 || page.Items[0].ID != second || page.Items[0].Title != domain.Title("segunda conversa") || page.NextCursor == "" {
		t.Fatalf("page 1 = %+v", page)
	}
	var next conversationList
	h.MustDo(http.MethodGet, "/api/v1/assistant/conversations?limit=1&cursor="+page.NextCursor, nil, http.StatusOK, &next)
	if len(next.Items) != 1 || next.Items[0].ID != first || next.NextCursor != "" {
		t.Fatalf("page 2 = %+v", next)
	}
	h.MustDo(http.MethodDelete, "/api/v1/assistant/conversations/"+first, nil, http.StatusNoContent, nil)
	h.ExpectProblem(h.Do(http.MethodGet, "/api/v1/assistant/conversations/"+first, nil), http.StatusNotFound, "conversation_not_found", "")
	h.ExpectProblem(h.Do(http.MethodDelete, "/api/v1/assistant/conversations/"+first, nil), http.StatusNotFound, "conversation_not_found", "")
}

// S141: deleting all conversations leaves another user's untouched.
func TestConversationDeleteAll(t *testing.T) {
	t.Parallel()
	h, tick := conversationHarness(t, 2)
	other := h.Login("other@example.com")
	newTurn(t, h, h.Client, tick, "minha")
	theirs := newTurn(t, h, other, tick, "dela")
	h.MustDo(http.MethodDelete, "/api/v1/assistant/conversations", nil, http.StatusNoContent, nil)
	var mine, hers conversationList
	h.MustDo(http.MethodGet, "/api/v1/assistant/conversations", nil, http.StatusOK, &mine)
	if r := h.Call(other, http.MethodGet, "/api/v1/assistant/conversations", nil); r.Status != http.StatusOK {
		t.Fatalf("status = %d", r.Status)
	} else {
		r.Decode(t, &hers)
	}
	if len(mine.Items) != 0 || len(hers.Items) != 1 || hers.Items[0].ID != theirs {
		t.Fatalf("mine = %+v, hers = %+v", mine, hers)
	}
}
