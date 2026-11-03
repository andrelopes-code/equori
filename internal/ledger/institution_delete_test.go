package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestDeleteInstitution(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	idle := createInstitution(t, h, "Idle bank")
	used := createInstitution(t, h, "Used bank")
	h.Account("Checking", "asset", "checking", map[string]any{"institution_id": used})

	if r := h.Do(http.MethodDelete, "/api/v1/institutions/"+idle, nil); r.Status != http.StatusNoContent {
		t.Fatalf("delete idle = %d: %s", r.Status, r.Body)
	}

	h.ExpectProblem(h.Do(http.MethodDelete, "/api/v1/institutions/"+idle, nil), http.StatusNotFound, "not_found", "")
	h.ExpectProblem(h.Do(http.MethodDelete, "/api/v1/institutions/"+used, nil), http.StatusConflict, "institution_in_use", "")

	var list struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/institutions", nil, http.StatusOK, &list)

	if len(list.Items) != 1 || list.Items[0].ID != used {
		t.Fatalf("institutions = %+v", list.Items)
	}
}

func TestDeleteInstitutionOfClosedAccount(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	bank := createInstitution(t, h, "Old bank")
	closed := h.Account("Old account", "asset", "cash", map[string]any{"institution_id": bank})
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+closed+"/close", map[string]string{"closed_on": "2026-10-31"}, http.StatusOK, nil)

	if r := h.Do(http.MethodDelete, "/api/v1/institutions/"+bank, nil); r.Status != http.StatusNoContent {
		t.Fatalf("delete = %d: %s", r.Status, r.Body)
	}

	var account struct {
		ID            string  `json:"id"`
		InstitutionID *string `json:"institution_id"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+closed, nil, http.StatusOK, &account)

	if account.ID != closed || account.InstitutionID != nil {
		t.Fatalf("closed account after delete = %+v", account)
	}
}

func TestDeleteInstitutionOfOtherBook(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	other := h.Login("other@example.com")

	var foreign struct {
		ID string `json:"id"`
	}
	h.Call(other, http.MethodPost, "/api/v1/institutions", map[string]any{"name": "Foreign bank"}).Decode(t, &foreign)

	h.ExpectProblem(h.Do(http.MethodDelete, "/api/v1/institutions/"+foreign.ID, nil), http.StatusNotFound, "not_found", "")

	if r := h.Call(other, http.MethodGet, "/api/v1/institutions", nil); r.Status != http.StatusOK {
		t.Fatalf("list = %d: %s", r.Status, r.Body)
	}
}

func createInstitution(t *testing.T, h *apitest.Harness, name string) string {
	t.Helper()

	var created struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]any{"name": name}, http.StatusCreated, &created)

	return created.ID
}
