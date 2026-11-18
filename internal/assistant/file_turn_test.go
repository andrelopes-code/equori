package assistant_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

// Assistant parity design F2 and F4: a message may carry files and no text; the model reads a
// descriptor of each file in the message and in the history of later turns, and a sent file is
// no longer removable.
func TestTurnWithFiles(t *testing.T) {
	t.Parallel()

	p := llmtest.New("aistudio", textStep("Li o extrato."), textStep("Sim."))
	h := turnHarness(t, p)

	statement := apitest.OFX("100.00")
	f := uploadFile(t, h, h.Client, nil, "extrato.ofx", statement, http.StatusCreated)
	descriptor := fmt.Sprintf("[file %s: extrato.ofx, ofx, %d bytes]", f.ID, len(statement))

	r := sendTurn(h, h.Client, map[string]any{"text": "", "file_ids": []string{f.ID}})
	if r.Status != http.StatusOK {
		t.Fatalf("turn status %d: %s", r.Status, r.Body)
	}

	if got := lastUserText(p.Requests()[0].Request); !strings.Contains(got, descriptor) {
		t.Errorf("user message = %q, want %q", got, descriptor)
	}

	conversation := turnConversation(t, r.Body)

	if msgs := conversationMessages(t, h, conversation); len(msgs) != 2 || msgs[0].Content != "" {
		t.Fatalf("messages = %+v, want an empty user message and its answer", msgs)
	}

	r = sendTurn(h, h.Client, map[string]any{"text": "Confere?", "conversation_id": conversation})
	if r.Status != http.StatusOK {
		t.Fatalf("second turn status %d: %s", r.Status, r.Body)
	}

	if history := p.Requests()[1].Request.Messages; len(history) < 3 ||
		!strings.Contains(partText(history[0]), descriptor) {
		t.Errorf("history = %+v, want the descriptor in the first user message", history)
	}

	h.ExpectProblem(
		h.Do(http.MethodDelete, filesPath+"/"+f.ID, nil),
		http.StatusNotFound,
		"file_not_found",
		"",
	)
}

func TestTurnWithFilesProblems(t *testing.T) {
	t.Parallel()

	h := turnHarness(t, llmtest.New("aistudio"))

	ids := make([]string, 6)
	for i := range ids {
		ids[i] = uploadFile(
			t,
			h,
			h.Client,
			nil,
			"a.txt",
			fmt.Appendf(nil, "note %d", i),
			http.StatusCreated,
		).ID
	}

	h.ExpectProblem(
		sendTurn(h, h.Client, map[string]any{"text": "x", "file_ids": ids}),
		http.StatusBadRequest,
		"invalid_request",
		"",
	)
	h.ExpectProblem(
		sendTurn(h, h.Client, map[string]any{"text": ""}),
		http.StatusBadRequest,
		"invalid_request",
		"",
	)
	h.ExpectProblem(
		sendTurn(h, h.Client, map[string]any{
			"text":     "x",
			"file_ids": []string{"66666666-6666-6666-6666-666666666666"},
		}),
		http.StatusNotFound,
		"file_not_found",
		"",
	)

	other := h.Login("other@example.com")
	h.ExpectProblem(
		sendTurn(h, other, map[string]any{"text": "x", "file_ids": ids[:1]}),
		http.StatusNotFound,
		"file_not_found",
		"",
	)
}

func lastUserText(req llm.Request) string {
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == llm.RoleUser {
			return partText(req.Messages[i])
		}
	}

	return ""
}

func partText(m llm.Message) string {
	var b strings.Builder
	for _, p := range m.Parts {
		b.WriteString(p.Text)
	}

	return b.String()
}

func turnConversation(t *testing.T, body []byte) string {
	t.Helper()

	var turn struct {
		ConversationID string `json:"conversation_id"`
	}

	events := parseSSE(body)
	if len(events) == 0 || events[0].Name != "turn" {
		t.Fatalf("events = %v", eventNames(events))
	}

	if err := json.Unmarshal([]byte(events[0].Data), &turn); err != nil {
		t.Fatal(err)
	}

	return turn.ConversationID
}
