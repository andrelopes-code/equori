package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestManageCardEditAndRemove(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	card := addCard(t, c, "Ana", "1234")

	edit := map[string]any{"account_id": c.card, "action": "edit_card", "card_id": card.ID, "holder": "Ana Souza", "last_four": "4321"}
	if p := previewTool(t, c.h, "manage_card", edit); p.Changes[0].Before.Text != "Ana 1234" || p.Changes[0].After.Text != "Ana Souza 4321" {
		t.Fatalf("edit preview = %+v", p)
	}

	var out cardOut
	toolOutput(t, c.h, "manage_card", edit, &out)

	var list struct {
		Items []cardView `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/cards", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || list.Items[0].Holder != "Ana Souza" || list.Items[0].LastFour != "4321" {
		t.Fatalf("cards after edit = %+v", list.Items)
	}

	c.h.ExpectToolError(c.h.Tool("manage_card", map[string]any{"account_id": c.card, "action": "edit_card", "card_id": card.ID}), "invalid_arguments", "holder")
	c.h.ExpectToolError(c.h.Tool("manage_card", map[string]any{"account_id": c.card, "action": "edit_card", "card_id": card.ID, "last_four": "12a4"}), "invalid_arguments", "last_four")

	remove := map[string]any{"account_id": c.card, "action": "remove_card", "card_id": card.ID}
	if p := previewTool(t, c.h, "manage_card", remove); !p.Destructive || p.Changes[0].Before.Text != "Ana Souza 4321" {
		t.Fatalf("remove preview = %+v", p)
	}

	toolOutput(t, c.h, "manage_card", remove, &out)
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/cards", nil, http.StatusOK, &list)

	if len(list.Items) != 0 {
		t.Fatalf("cards after remove = %+v", list.Items)
	}

	c.h.ExpectToolError(c.h.Tool("manage_card", remove), "not_found", "")
}

func TestManageAccountsDeleteInstitution(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	idle := createInstitution(t, h, "Idle bank")
	used := createInstitution(t, h, "Used bank")
	h.Account("Checking", "asset", "checking", map[string]any{"institution_id": used})

	drop := map[string]any{"action": "delete_institution", "institution_id": idle}
	if p := previewTool(t, h, "manage_accounts_and_payees", drop); !p.Destructive || p.Target != "Idle bank" {
		t.Fatalf("preview = %+v", p)
	}

	var out struct {
		Action string `json:"action"`
	}
	toolOutput(t, h, "manage_accounts_and_payees", drop, &out)

	var list struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/institutions", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || list.Items[0].ID != used {
		t.Fatalf("institutions = %+v", list.Items)
	}

	h.ExpectToolError(h.Tool("manage_accounts_and_payees", map[string]any{"action": "delete_institution", "institution_id": used}), "institution_in_use", "")
	h.ExpectToolError(h.Tool("manage_accounts_and_payees", drop), "not_found", "")
}
