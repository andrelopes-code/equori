package ledger_test

import (
	"net/http"
	"testing"
)

type cardView struct {
	ID       string `json:"id"`
	Holder   string `json:"holder"`
	LastFour string `json:"last_four"`
	Active   bool   `json:"active"`
}

func TestEditCard(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	card := addCard(t, c, "Ana", "1234")

	var edited cardView
	c.h.MustDo(http.MethodPatch, "/api/v1/cards/"+card.ID, map[string]any{"holder": "Ana Souza", "last_four": "4321"}, http.StatusOK, &edited)

	if edited.Holder != "Ana Souza" || edited.LastFour != "4321" || !edited.Active {
		t.Fatalf("edited = %+v", edited)
	}

	var off cardView
	c.h.MustDo(http.MethodPatch, "/api/v1/cards/"+card.ID, map[string]any{"active": false}, http.StatusOK, &off)

	if off.Holder != "Ana Souza" || off.LastFour != "4321" || off.Active {
		t.Fatalf("off = %+v", off)
	}
}

func TestEditCardInvalid(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	card := addCard(t, c, "Ana", "1234")

	c.h.ExpectProblem(c.h.Do(http.MethodPatch, "/api/v1/cards/"+card.ID, map[string]any{"last_four": "12a4"}),
		http.StatusBadRequest, "invalid_request", "")
	c.h.ExpectProblem(c.h.Do(http.MethodPatch, "/api/v1/cards/"+card.ID, map[string]any{"holder": "  "}),
		http.StatusUnprocessableEntity, "validation_failed", "holder")

	var list struct {
		Items []cardView `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/cards", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || list.Items[0].Holder != "Ana" || list.Items[0].LastFour != "1234" {
		t.Errorf("cards after rejected edits = %+v", list.Items)
	}
}

func TestDeleteCard(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	keep := addCard(t, c, "Bia", "9999")
	gone := addCard(t, c, "Ana", "1234")

	if r := c.h.Do(http.MethodDelete, "/api/v1/cards/"+gone.ID, nil); r.Status != http.StatusNoContent {
		t.Fatalf("delete = %d: %s", r.Status, r.Body)
	}

	var list struct {
		Items []cardView `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/cards", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || list.Items[0].ID != keep.ID {
		t.Fatalf("cards = %+v", list.Items)
	}

	c.h.ExpectProblem(c.h.Do(http.MethodDelete, "/api/v1/cards/"+gone.ID, nil), http.StatusNotFound, "not_found", "")
}

func TestCardOfOtherBook(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	other := c.h.Login("other@example.com")

	var account struct {
		ID string `json:"id"`
	}
	c.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Foreign card", "class": "liability", "kind": "credit_card", "currency": "BRL"}).Decode(t, &account)
	foreignAccount := account.ID

	var foreign cardView
	c.h.Call(other, http.MethodPost, "/api/v1/accounts/"+foreignAccount+"/cards", map[string]any{"holder": "Zed", "last_four": "0001"}).Decode(t, &foreign)

	c.h.ExpectProblem(c.h.Do(http.MethodDelete, "/api/v1/cards/"+foreign.ID, nil), http.StatusNotFound, "not_found", "")
	c.h.ExpectProblem(c.h.Do(http.MethodPatch, "/api/v1/cards/"+foreign.ID, map[string]any{"holder": "Mine"}), http.StatusNotFound, "not_found", "")

	var list struct {
		Items []cardView `json:"items"`
	}
	c.h.Call(other, http.MethodGet, "/api/v1/accounts/"+foreignAccount+"/cards", nil).Decode(t, &list)

	if len(list.Items) != 1 || list.Items[0].Holder != "Zed" {
		t.Errorf("foreign cards = %+v", list.Items)
	}
}

func addCard(t *testing.T, c cardSetup, holder, lastFour string) cardView {
	t.Helper()

	var card cardView
	c.h.MustDo(http.MethodPost, "/api/v1/accounts/"+c.card+"/cards", map[string]any{"holder": holder, "last_four": lastFour}, http.StatusCreated, &card)

	return card
}
