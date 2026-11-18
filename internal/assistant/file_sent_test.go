package assistant_test

import (
	"bytes"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

// Assistant parity design FU5: a sent message lists the files it carried, and the member who sent
// them opens each one with the media type of its content.
func TestSentMessageFiles(t *testing.T) {
	t.Parallel()

	h := turnHarness(t, llmtest.New("aistudio", textStep("Li.")))

	statement := apitest.OFX("100.00")
	ofx := uploadFile(t, h, h.Client, nil, "extrato.ofx", statement, http.StatusCreated)
	note := uploadFile(t, h, h.Client, nil, "nota.txt", []byte("receipt"), http.StatusCreated)

	r := sendTurn(h, h.Client, map[string]any{"text": "Lê", "file_ids": []string{ofx.ID, note.ID}})
	if r.Status != http.StatusOK {
		t.Fatalf("turn status %d: %s", r.Status, r.Body)
	}

	conversation := turnConversation(t, r.Body)

	var d struct {
		Messages []struct {
			Role  string       `json:"role"`
			Files []storedFile `json:"files"`
		} `json:"messages"`
	}
	h.MustDo(
		http.MethodGet,
		"/api/v1/assistant/conversations/"+conversation,
		nil,
		http.StatusOK,
		&d,
	)

	want := []storedFile{
		{
			ID:             ofx.ID,
			ConversationID: conversation,
			Name:           "extrato.ofx",
			Kind:           "ofx",
			Size:           len(statement),
		},
		{ID: note.ID, ConversationID: conversation, Name: "nota.txt", Kind: "text", Size: 7},
	}
	// The fixed clock gives both files one upload time; the order between them is the id's.
	if len(d.Messages) == 2 {
		slices.SortFunc(d.Messages[0].Files, func(a, b storedFile) int {
			return strings.Compare(a.Name, b.Name)
		})
	}

	if len(d.Messages) != 2 || len(d.Messages[0].Files) != 2 ||
		d.Messages[0].Files[0] != want[0] || d.Messages[0].Files[1] != want[1] ||
		len(d.Messages[1].Files) != 0 {
		t.Fatalf("messages = %+v, want the user message with %+v", d.Messages, want)
	}

	content := h.Do(http.MethodGet, filesPath+"/"+note.ID+"/content", nil)
	if content.Status != http.StatusOK || !bytes.Equal(content.Body, []byte("receipt")) ||
		content.Header.Get("Content-Type") != "text/plain; charset=utf-8" ||
		content.Header.Get("Content-Disposition") != "inline; filename=nota.txt" {
		t.Errorf(
			"content = %d %q %v, want 200 text/plain inline",
			content.Status,
			content.Body,
			content.Header,
		)
	}

	other := h.Login("other@example.com")
	h.ExpectProblem(
		h.Call(other, http.MethodGet, filesPath+"/"+note.ID+"/content", nil),
		http.StatusNotFound,
		"file_not_found",
		"",
	)
}
