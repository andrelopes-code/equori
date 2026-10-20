package ledger_test

import (
	"net/http"
	"testing"
)

type appearanceView struct {
	ID       string  `json:"id"`
	Color    *int    `json:"color"`
	Icon     *string `json:"icon"`
	ParentID string  `json:"parent_id"`
}

// A83: a category's colour and icon are set, read back and cleared.
func TestAccountAppearance(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	var out appearanceView
	c.h.MustDo(http.MethodPut, "/api/v1/accounts/"+c.food+"/appearance", map[string]any{"color": 3, "icon": "utensils"}, http.StatusOK, &out)
	if out.Color == nil || *out.Color != 3 || out.Icon == nil || *out.Icon != "utensils" {
		t.Fatalf("appearance = %+v", out)
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts/"+c.food, nil, http.StatusOK, &out)
	if out.Color == nil || *out.Color != 3 || out.Icon == nil || *out.Icon != "utensils" {
		t.Fatalf("read back = %+v", out)
	}
	var cleared appearanceView
	c.h.MustDo(http.MethodPut, "/api/v1/accounts/"+c.food+"/appearance", map[string]any{"color": nil, "icon": nil}, http.StatusOK, &cleared)
	if cleared.Color != nil || cleared.Icon != nil {
		t.Fatalf("cleared = %+v", cleared)
	}
}

func TestAccountAppearanceOnCreate(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	var out appearanceView
	c.h.MustDo(http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Pets", "class": "expense", "currency": "BRL", "color": 5, "icon": "paw-print"}, http.StatusCreated, &out)
	if out.Color == nil || *out.Color != 5 || out.Icon == nil || *out.Icon != "paw-print" {
		t.Fatalf("created = %+v", out)
	}
}

// A83: the account list carries the appearance the record carries.
func TestAccountAppearanceInList(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	c.h.MustDo(http.MethodPut, "/api/v1/accounts/"+c.food+"/appearance", map[string]any{"color": 3, "icon": "utensils"}, http.StatusOK, nil)
	var list struct {
		Items []appearanceView `json:"items"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &list)
	for _, item := range list.Items {
		if item.ID != c.food {
			continue
		}
		if item.Color == nil || *item.Color != 3 || item.Icon == nil || *item.Icon != "utensils" {
			t.Fatalf("listed food = %+v", item)
		}
		return
	}
	t.Fatalf("food %s not listed", c.food)
}

func TestAccountAppearanceRejections(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	for _, body := range []map[string]any{
		{"color": 9, "icon": nil},
		{"color": nil, "icon": "not-an-icon"},
		{"color": 1},
	} {
		c.h.ExpectProblem(c.h.Do(http.MethodPut, "/api/v1/accounts/"+c.food+"/appearance", body), http.StatusBadRequest, "invalid_request", "")
	}
}

// A84, Review Focus 5: the parent is set or cleared; an open account never goes under a closed one.
func TestSetAccountParent(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	var out appearanceView
	c.h.MustDo(http.MethodPut, "/api/v1/accounts/"+c.bakery+"/parent", map[string]any{"parent_id": nil}, http.StatusOK, &out)
	if out.ParentID != "" {
		t.Fatalf("bakery parent = %q, want top level", out.ParentID)
	}
	c.h.MustDo(http.MethodPut, "/api/v1/accounts/"+c.bakery+"/parent", map[string]any{"parent_id": c.delivery}, http.StatusOK, &out)
	if out.ParentID != c.delivery {
		t.Fatalf("bakery parent = %q, want delivery", out.ParentID)
	}
	c.h.ExpectProblem(c.h.Do(http.MethodPut, "/api/v1/accounts/"+c.food+"/parent", map[string]any{"parent_id": c.bakery}),
		http.StatusUnprocessableEntity, "validation_failed", "parent_id")

	c.h.MustDo(http.MethodPost, "/api/v1/accounts/"+c.food+"/close", map[string]string{"closed_on": "2026-10-31"}, http.StatusOK, nil)
	c.h.MustDo(http.MethodPut, "/api/v1/accounts/"+c.delivery+"/parent", map[string]any{"parent_id": nil}, http.StatusOK, nil)
	open := c.h.Account("Open", "expense", "", nil)
	c.h.ExpectProblem(c.h.Do(http.MethodPut, "/api/v1/accounts/"+open+"/parent", map[string]any{"parent_id": c.food}),
		http.StatusUnprocessableEntity, "validation_failed", "parent_id")
}
