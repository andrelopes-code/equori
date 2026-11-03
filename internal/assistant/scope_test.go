package assistant_test

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

// S136 (part): a member with the role read can have a write tool proposed by the model, and
// cannot confirm it. The transaction stays unvoided.
func TestReaderCannotConfirmProposal(t *testing.T) {
	t.Parallel()
	late := &lateProvider{}
	h := apitest.New(t, apitest.LLM(late), apitest.Today("2026-10-23"))
	txID := h.Record("2026-10-20",
		apitest.Posting(h.Account("Wallet", "asset", "cash", nil), -1250),
		apitest.Posting(h.Account("Food", "expense", "", nil), 1250),
	)
	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	late.p = llmtest.New("aistudio",
		callStep("void_transaction", `{"transaction_id":"`+txID+`","reason":"x"}`),
		textStep("ok"),
	)

	r := sendTurn(h, reader, map[string]any{"text": "Anula a transação."})
	proposalID := firstProposalID(t, r)

	confirm := h.Call(reader, http.MethodPost, "/api/v1/assistant/proposals/"+proposalID+"/confirm", nil)
	if confirm.Status != http.StatusForbidden {
		t.Fatalf("confirm status = %d, want 403: %s", confirm.Status, confirm.Body)
	}

	var got struct {
		VoidedAt string `json:"voided_at"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+txID, nil, http.StatusOK, &got)

	if got.VoidedAt != "" {
		t.Fatal("the transaction was voided by a member with the role read")
	}
}

// A books_id in the arguments of a tool call is rejected by the tool schema and reads nothing.
func TestForgedBooksIDArgumentRejected(t *testing.T) {
	t.Parallel()
	const secret = "SegredoOutroLivro"
	late := &lateProvider{}
	h := apitest.New(t, apitest.LLM(late), apitest.Today("2026-10-23"))
	other := h.Login("other@example.com")

	if r := h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{
		"name": secret, "class": "asset", "kind": "cash", "currency": "BRL",
	}); r.Status != http.StatusCreated {
		t.Fatalf("create account status = %d: %s", r.Status, r.Body)
	}

	args := `{"books_id":` + strconv.FormatInt(h.BooksIDOf("other@example.com"), 10) + `}`
	late.p = llmtest.New("aistudio", callStep("list_accounts", args), textStep("ok"))

	sendTurn(h, h.Client, map[string]any{"text": "Lista as contas."})

	var results []string

	for _, m := range late.p.Requests()[1].Request.Messages {
		for _, p := range m.Parts {
			if p.ToolResult != nil {
				results = append(results, string(p.ToolResult.Content))
			}
		}
	}

	joined := strings.Join(results, "\n")
	if !strings.Contains(joined, "invalid_arguments") {
		t.Fatalf("the tool call with books_id was not rejected: %q", joined)
	}

	if strings.Contains(joined, secret) {
		t.Fatalf("a tool result carries the account of another book: %s", joined)
	}
}

func firstProposalID(t *testing.T, r apitest.Response) string {
	t.Helper()

	events := parseSSE(r.Body)
	last := events[len(events)-1]

	var answer struct {
		Proposals []struct {
			ID string `json:"id"`
		} `json:"proposals"`
	}
	if last.Name != "answer" || json.Unmarshal([]byte(last.Data), &answer) != nil {
		t.Fatalf("events = %s", r.Body)
	}

	if len(answer.Proposals) != 1 {
		t.Fatalf("proposals = %+v", answer.Proposals)
	}

	return answer.Proposals[0].ID
}
