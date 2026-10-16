package classification_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func payee(t *testing.T, h *apitest.Harness, name string) string {
	t.Helper()
	var out struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": name}, http.StatusCreated, &out)
	return out.ID
}

type aliasView struct {
	ID        string `json:"id"`
	Pattern   string `json:"pattern"`
	MatchType string `json:"match_type"`
	PayeeID   string `json:"payee_id"`
}

func TestAliasLifecycle(t *testing.T) {
	h := apitest.New(t)
	ifood := payee(t, h, "iFood")
	rappi := payee(t, h, "Rappi")

	var created aliasView
	r := h.Do(http.MethodPost, "/api/v1/payee-aliases", map[string]any{"pattern": "IFD*", "match_type": "starts_with", "payee_id": ifood})
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}
	r.Decode(t, &created)
	if created.Pattern != "IFD*" || created.MatchType != "starts_with" || created.PayeeID != ifood || r.Header.Get("Location") != "/api/v1/payee-aliases/"+created.ID {
		t.Fatalf("alias = %+v, Location %q", created, r.Header.Get("Location"))
	}
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/payee-aliases", map[string]any{"pattern": "IFD*", "match_type": "starts_with", "payee_id": rappi}),
		http.StatusUnprocessableEntity, "validation_failed", "pattern")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/payee-aliases", map[string]any{"pattern": "(", "match_type": "regex", "payee_id": rappi}),
		http.StatusUnprocessableEntity, "validation_failed", "pattern")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/payee-aliases", map[string]any{"pattern": "x", "match_type": "equals", "payee_id": "00000000-0000-7000-8000-000000000000"}),
		http.StatusUnprocessableEntity, "validation_failed", "payee_id")

	var changed aliasView
	h.MustDo(http.MethodPut, "/api/v1/payee-aliases/"+created.ID, map[string]any{"pattern": "rappi", "match_type": "contains", "payee_id": rappi}, http.StatusOK, &changed)
	if changed.ID != created.ID || changed.Pattern != "rappi" || changed.PayeeID != rappi {
		t.Fatalf("changed = %+v", changed)
	}
	var list struct {
		Items []aliasView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/payee-aliases", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0] != changed {
		t.Fatalf("list = %+v", list.Items)
	}

	other := h.Login("other@example.com")
	h.ExpectProblem(h.Call(other, http.MethodGet, "/api/v1/payee-aliases/"+created.ID, nil), http.StatusNotFound, "not_found", "")
	h.MustDo(http.MethodDelete, "/api/v1/payee-aliases/"+created.ID, nil, http.StatusNoContent, nil)
	h.ExpectProblem(h.Do(http.MethodDelete, "/api/v1/payee-aliases/"+created.ID, nil), http.StatusNotFound, "not_found", "")
}
