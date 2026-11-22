package assistant_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

// Undo restore design, U4 and U7: a categorization the member confirmed is undone by the internal
// restore, which the model never sees among its tools.
func TestUndoRestoresACategorization(t *testing.T) {
	t.Parallel()

	late := &lateProvider{}
	h := apitest.New(t, apitest.LLM(late), apitest.Today("2026-10-23"))

	account := h.Account("Conta", "asset", "checking", nil)
	food := h.Account("Mercado", "expense", "", nil)
	leisure := h.Account("Lazer", "expense", "", nil)
	tx := h.Record("2026-10-20", h.Posting(account, -1000), h.Posting(food, 1000))
	h.Dispatch()

	args := `{"transaction_ids":["` + tx + `"],"category_id":"` + leisure + `"}`
	late.p = llmtest.New("aistudio", callStep("categorize_transactions", args), textStep("ok"))

	r := sendTurn(h, h.Client, map[string]any{"text": "Categorize como lazer"})
	if r.Status != http.StatusOK {
		t.Fatalf("turn = %d: %s", r.Status, r.Body)
	}

	for _, d := range late.p.Requests()[0].Request.Tools {
		if d.Name == "restore_transaction" {
			t.Fatal("the model sees the internal tool restore_transaction")
		}
	}

	var proposed struct {
		ProposalID string `json:"proposal_id"`
	}
	if err := json.Unmarshal(toolResults(late.p)[0].Content, &proposed); err != nil {
		t.Fatal(err)
	}

	base := "/api/v1/assistant/proposals/" + proposed.ProposalID

	var confirmed undoView
	h.MustDo(http.MethodPost, base+"/confirm", nil, http.StatusOK, &confirmed)

	if !confirmed.Undoable || categoryHolds(h, leisure) != 1 || categoryHolds(h, food) != 0 {
		t.Fatalf("confirmed = %+v", confirmed)
	}

	var undone undoView
	h.MustDo(
		http.MethodPost,
		base+"/undo",
		map[string]string{"reason": "Desfeita no assistente"},
		http.StatusOK,
		&undone,
	)

	if undone.Status != "executed" || undone.Tool != "restore_transaction" ||
		categoryHolds(h, food) != 1 || categoryHolds(h, leisure) != 0 {
		t.Fatalf("undone = %+v", undone)
	}
}

// categoryHolds counts the transactions search_transactions finds on a category.
func categoryHolds(h *apitest.Harness, category string) int {
	var out struct {
		Transactions []json.RawMessage `json:"transactions"`
	}

	r := h.Tool("search_transactions", map[string]any{"account_id": category})
	if err := json.Unmarshal(r.Content, &out); err != nil {
		return -1
	}

	return len(out.Transactions)
}
