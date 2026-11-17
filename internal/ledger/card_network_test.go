package ledger_test

import (
	"net/http"
	"testing"
)

// Card faces spec 4.6: the network of a plastic card.

type networkCard struct {
	ID       string  `json:"id"`
	Holder   string  `json:"holder"`
	LastFour string  `json:"last_four"`
	Network  *string `json:"network"`
}

func TestCardNetworkCreate(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")

	var created networkCard
	c.h.MustDo(
		http.MethodPost,
		"/api/v1/accounts/"+c.card+"/cards",
		map[string]any{"holder": "Ana", "last_four": "1234", "network": "visa"},
		http.StatusCreated,
		&created,
	)

	if created.Network == nil || *created.Network != "visa" {
		t.Fatalf("created network = %v, want visa", created.Network)
	}

	var list struct {
		Items []networkCard `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/cards", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || list.Items[0].Network == nil || *list.Items[0].Network != "visa" {
		t.Fatalf("listed cards = %+v", list.Items)
	}
}

func TestCardNetworkOmittedWhenUnset(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")

	var created map[string]any
	c.h.MustDo(
		http.MethodPost,
		"/api/v1/accounts/"+c.card+"/cards",
		map[string]any{"holder": "Ana", "last_four": "1234"},
		http.StatusCreated,
		&created,
	)

	if _, ok := created["network"]; ok {
		t.Errorf("created card has a network: %v", created)
	}

	var list struct {
		Items []map[string]any `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/cards", nil, http.StatusOK, &list)

	if len(list.Items) != 1 {
		t.Fatalf("listed cards = %+v", list.Items)
	}

	if _, ok := list.Items[0]["network"]; ok {
		t.Errorf("listed card has a network: %v", list.Items[0])
	}
}

func TestCardNetworkEdit(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	card := patchableCard(t, c, "visa")

	var changed networkCard
	c.h.MustDo(
		http.MethodPatch,
		"/api/v1/cards/"+card.ID,
		map[string]any{"network": "mastercard"},
		http.StatusOK,
		&changed,
	)

	if changed.Network == nil || *changed.Network != "mastercard" {
		t.Fatalf("changed network = %v, want mastercard", changed.Network)
	}

	var kept networkCard
	c.h.MustDo(
		http.MethodPatch,
		"/api/v1/cards/"+card.ID,
		map[string]any{"holder": "X"},
		http.StatusOK,
		&kept,
	)

	if kept.Holder != "X" || kept.Network == nil || *kept.Network != "mastercard" {
		t.Fatalf("kept = %+v", kept)
	}
}

func TestCardNetworkClear(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	card := patchableCard(t, c, "visa")

	var cleared map[string]any
	c.h.MustDo(
		http.MethodPatch,
		"/api/v1/cards/"+card.ID,
		map[string]any{"network": ""},
		http.StatusOK,
		&cleared,
	)

	if _, ok := cleared["network"]; ok {
		t.Errorf("cleared card has a network: %v", cleared)
	}

	if cleared["holder"] != "Ana" || cleared["last_four"] != "1234" || cleared["active"] != true {
		t.Errorf("cleared card changed other fields: %v", cleared)
	}
}

func TestCardNetworkRejectsInvalidKey(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-10-23")
	valid := patchableCard(t, c, "visa")

	c.h.ExpectProblem(
		c.h.Do(
			http.MethodPost,
			"/api/v1/accounts/"+c.card+"/cards",
			map[string]any{"holder": "Bia", "last_four": "9999", "network": "VISA!"},
		),
		http.StatusBadRequest,
		"invalid_request",
		"",
	)

	var list struct {
		Items []networkCard `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.card+"/cards", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || list.Items[0].ID != valid.ID {
		t.Errorf("cards after the rejected create = %+v", list.Items)
	}
}

func patchableCard(t *testing.T, c cardSetup, network string) networkCard {
	t.Helper()

	var card networkCard
	c.h.MustDo(
		http.MethodPost,
		"/api/v1/accounts/"+c.card+"/cards",
		map[string]any{"holder": "Ana", "last_four": "1234", "network": network},
		http.StatusCreated,
		&card,
	)

	return card
}
