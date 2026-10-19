package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type accountView struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ParentID string `json:"parent_id"`
	ClosedOn string `json:"closed_on"`
}

func getAccount(t *testing.T, h *apitest.Harness, id string) accountView {
	t.Helper()
	var out accountView
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+id, nil, http.StatusOK, &out)
	return out
}

// S72: an account cannot move under its own descendant (A73).
func TestMoveUnderDescendantIs422(t *testing.T) {
	h := apitest.New(t)
	food := h.Account("Food", "expense", "", nil)
	groceries := h.Account("Groceries", "expense", "", map[string]any{"parent_id": food})
	organic := h.Account("Organic", "expense", "", map[string]any{"parent_id": groceries})

	for _, target := range []string{groceries, organic} {
		h.ExpectProblem(h.Do(http.MethodPatch, "/api/v1/accounts/"+food, map[string]any{"parent_id": target}),
			http.StatusUnprocessableEntity, "validation_failed", "parent_id")
	}
	if a := getAccount(t, h, food); a.ParentID != "" {
		t.Fatalf("food parent = %q", a.ParentID)
	}
	if a := getAccount(t, h, groceries); a.ParentID != food {
		t.Fatalf("groceries parent = %q, want food", a.ParentID)
	}
}

type categoryTree struct {
	h                                 *apitest.Harness
	checking, food, bakery, delivery  string
	uncategorizedExpense, feesAccount string
}

// newCategoryTree builds Food › Bakery and Food › Delivery beside a checking account.
func newCategoryTree(t *testing.T) categoryTree {
	t.Helper()
	h := apitest.New(t)
	c := categoryTree{h: h}
	var accounts struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)
	for _, a := range accounts.Items {
		switch a.SystemRole {
		case "uncategorized_expense":
			c.uncategorizedExpense = a.ID
		case "fees":
			c.feesAccount = a.ID
		}
	}
	c.checking = h.Account("Nubank", "asset", "checking", nil)
	c.food = h.Account("Food", "expense", "", nil)
	c.bakery = h.Account("Bakery", "expense", "", map[string]any{"parent_id": c.food})
	c.delivery = h.Account("Delivery", "expense", "", map[string]any{"parent_id": c.food})
	return c
}

func (c categoryTree) close(id, on string) apitest.Response {
	return c.h.Do(http.MethodPost, "/api/v1/accounts/"+id+"/close", map[string]string{"closed_on": on})
}

func (c categoryTree) requireClosedOn(t *testing.T, want string, ids ...string) {
	t.Helper()
	for _, id := range ids {
		if got := getAccount(t, c.h, id).ClosedOn; got != want {
			t.Fatalf("account %s closed_on = %q, want %q", id, got, want)
		}
	}
}

// A74: closing a category ignores its balance and closes its open descendants.
func TestArchiveCategoryWithPostings(t *testing.T) {
	c := newCategoryTree(t)
	c.h.Record("2026-10-10", apitest.Posting(c.checking, -850), apitest.Posting(c.bakery, 850))

	var out accountView
	r := c.close(c.food, "2026-10-31")
	if r.Status != http.StatusOK {
		t.Fatalf("close status %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &out)
	if out.ClosedOn != "2026-10-31" {
		t.Fatalf("closed food = %+v", out)
	}
	c.requireClosedOn(t, "2026-10-31", c.bakery, c.delivery)
	for _, id := range []string{c.food, c.bakery, c.delivery} {
		if n := len(events(t, c.h, id)["ledger.account_closed.v1"]); n != 1 {
			t.Fatalf("account %s has %d account_closed events, want 1", id, n)
		}
	}
}

func TestArchiveRejectsPostingsAfterDate(t *testing.T) {
	c := newCategoryTree(t)
	c.h.Record("2026-11-02", apitest.Posting(c.checking, -850), apitest.Posting(c.bakery, 850))
	c.h.ExpectProblem(c.close(c.food, "2026-10-31"), http.StatusConflict, "account_not_empty", "")
	c.requireClosedOn(t, "", c.food, c.bakery, c.delivery)
}

// Review Focus 3: a descendant opened after the closing date rejects the whole close.
func TestArchiveRejectsLateOpenedDescendant(t *testing.T) {
	c := newCategoryTree(t)
	organic := c.h.Account("Organic", "expense", "", map[string]any{"parent_id": c.food, "opened_on": "2026-11-15"})
	c.h.ExpectProblem(c.close(c.food, "2026-10-31"), http.StatusUnprocessableEntity, "validation_failed", "closed_on")
	c.requireClosedOn(t, "", c.food, c.bakery, c.delivery, organic)
}

// S73: a system account is never closed (A74).
func TestCloseSystemAccountIs422(t *testing.T) {
	c := newCategoryTree(t)
	c.h.ExpectProblem(c.close(c.uncategorizedExpense, "2026-10-31"), http.StatusUnprocessableEntity, "system_account", "")
	c.requireClosedOn(t, "", c.uncategorizedExpense)
}

// Review Focus 1: a system account inside the subtree blocks the close.
func TestArchiveRejectsSystemAccountInSubtree(t *testing.T) {
	c := newCategoryTree(t)
	c.h.MustDo(http.MethodPatch, "/api/v1/accounts/"+c.feesAccount, map[string]any{"parent_id": c.food}, http.StatusOK, nil)
	c.h.ExpectProblem(c.close(c.food, "2026-10-31"), http.StatusUnprocessableEntity, "system_account", "")
	c.requireClosedOn(t, "", c.food, c.bakery, c.delivery, c.feesAccount)
}

func TestOpenAccountUnderClosedParentIs422(t *testing.T) {
	c := newCategoryTree(t)
	c.h.MustDo(http.MethodPost, "/api/v1/accounts/"+c.delivery+"/close", map[string]string{"closed_on": "2026-10-31"}, http.StatusOK, nil)
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Pizza", "class": "expense", "currency": "BRL", "parent_id": c.delivery}),
		http.StatusUnprocessableEntity, "validation_failed", "parent_id")
	c.h.ExpectProblem(c.h.Do(http.MethodPatch, "/api/v1/accounts/"+c.bakery, map[string]any{"parent_id": c.delivery}),
		http.StatusUnprocessableEntity, "validation_failed", "parent_id")
}

// Review Focus 2: the open-parent rule applies only to open accounts.
func TestRenameArchivedChildOfArchivedParent(t *testing.T) {
	c := newCategoryTree(t)
	c.h.MustDo(http.MethodPost, "/api/v1/accounts/"+c.food+"/close", map[string]string{"closed_on": "2026-10-31"}, http.StatusOK, nil)
	var out accountView
	c.h.MustDo(http.MethodPatch, "/api/v1/accounts/"+c.bakery, map[string]any{"name": "Old bakery"}, http.StatusOK, &out)
	if out.Name != "Old bakery" || out.ClosedOn != "2026-10-31" {
		t.Fatalf("bakery = %+v", out)
	}
}

func (c categoryTree) reopen(id string) apitest.Response {
	return c.h.Do(http.MethodPost, "/api/v1/accounts/"+id+"/reopen", nil)
}

// A74, Review Focus 4: reopening reopens the closed ancestors and leaves siblings closed.
func TestReopenCategoryReopensAncestors(t *testing.T) {
	c := newCategoryTree(t)
	c.h.MustDo(http.MethodPost, "/api/v1/accounts/"+c.food+"/close", map[string]string{"closed_on": "2026-10-31"}, http.StatusOK, nil)

	r := c.reopen(c.bakery)
	if r.Status != http.StatusOK {
		t.Fatalf("reopen status %d: %s", r.Status, r.Body)
	}
	var out accountView
	r.Decode(t, &out)
	if out.ID != c.bakery || out.ClosedOn != "" {
		t.Fatalf("reopened bakery = %+v", out)
	}
	c.requireClosedOn(t, "", c.food)
	c.requireClosedOn(t, "2026-10-31", c.delivery)
	for id, want := range map[string]int{c.bakery: 1, c.food: 1, c.delivery: 0} {
		if n := len(events(t, c.h, id)["ledger.account_reopened.v1"]); n != want {
			t.Fatalf("account %s has %d account_reopened events, want %d", id, n, want)
		}
	}
}

func TestReopenOpenAccountIs422(t *testing.T) {
	c := newCategoryTree(t)
	c.h.ExpectProblem(c.reopen(c.food), http.StatusUnprocessableEntity, "validation_failed", "")
}

func TestReopenSystemAccountIs422(t *testing.T) {
	c := newCategoryTree(t)
	c.h.ExpectProblem(c.reopen(c.uncategorizedExpense), http.StatusUnprocessableEntity, "system_account", "")
}

func TestReopenForeignAccountIs404(t *testing.T) {
	c := newCategoryTree(t)
	other := c.h.Login("other@example.com")
	var foreign idOnly
	c.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Food", "class": "expense", "currency": "BRL"}).Decode(t, &foreign)
	c.h.Call(other, http.MethodPost, "/api/v1/accounts/"+foreign.ID+"/close", map[string]string{"closed_on": "2026-10-31"})
	c.h.ExpectProblem(c.reopen(foreign.ID), http.StatusNotFound, "not_found", "")
}
