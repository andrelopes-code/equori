package assistant_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/llm/llmtest"
)

// HA17 (amended 2026-11-16): the model of a member below the role of a tool is not offered the
// tool; the model of an owner is offered every tool.
func TestOwnerToolsDeclaredByRole(t *testing.T) {
	t.Parallel()

	p := llmtest.New("aistudio", textStep("ok"), textStep("ok"), textStep("ok"))
	h := turnHarness(t, p)
	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")
	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")

	for _, c := range []*http.Client{h.Client, writer, reader} {
		if r := sendTurn(h, c, map[string]any{"text": "Oi."}); r.Status != http.StatusOK {
			t.Fatalf("turn status = %d: %s", r.Status, r.Body)
		}
	}

	tests := []struct {
		who   string
		call  int
		write bool
		owner bool
	}{
		{"owner", 0, true, true},
		{"writer", 1, true, false},
		{"reader", 2, false, false},
	}

	calls := p.Requests()
	for _, tt := range tests {
		var names []string
		for _, d := range calls[tt.call].Request.Tools {
			names = append(names, d.Name)
		}

		got := [4]bool{
			slices.Contains(names, "list_accounts"),
			slices.Contains(names, "record_transaction"),
			slices.Contains(names, "manage_book"),
			slices.Contains(names, "get_book_access"),
		}
		if want := [4]bool{true, tt.write, tt.owner, tt.owner}; got != want {
			t.Errorf(
				"%s: list_accounts, record_transaction, manage_book, get_book_access offered = %v, want %v",
				tt.who,
				got,
				want,
			)
		}
	}
}

// HA16: an owner's proposal of manage_book runs on confirmation, and the proposal of a model that
// calls it for a member below owner is refused before it is stored.
func TestManageBookProposal(t *testing.T) {
	t.Parallel()

	p := llmtest.New("aistudio",
		callStep("manage_book", `{"action":"update_book","name":"Casa"}`),
		textStep("ok"),
		callStep("manage_book", `{"action":"update_book","name":"Outra"}`),
		textStep("ok"),
	)
	h := turnHarness(t, p)
	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")

	r := sendTurn(h, h.Client, map[string]any{"text": "Renomeia o livro para Casa."})
	id := firstProposalID(t, r)

	var settings struct {
		Name string `json:"name"`
	}
	h.MustDo(http.MethodGet, "/api/v1/books/current", nil, http.StatusOK, &settings)

	if settings.Name == "Casa" {
		t.Fatal("the book was renamed before the confirmation")
	}

	h.MustDo(http.MethodPost, "/api/v1/assistant/proposals/"+id+"/confirm", nil, http.StatusOK, nil)
	h.MustDo(http.MethodGet, "/api/v1/books/current", nil, http.StatusOK, &settings)

	if settings.Name != "Casa" {
		t.Errorf("name = %q, want Casa", settings.Name)
	}

	before := h.Rows(`SELECT id::text FROM assistant_proposal`)

	if r := sendTurn(
		h,
		writer,
		map[string]any{"text": "Renomeia o livro."},
	); r.Status != http.StatusOK {
		t.Fatalf("writer turn status = %d: %s", r.Status, r.Body)
	}

	if after := h.Rows(`SELECT id::text FROM assistant_proposal`); !slices.Equal(after, before) {
		t.Errorf("proposals = %v, want %v: a member below owner stored a proposal", after, before)
	}
}
