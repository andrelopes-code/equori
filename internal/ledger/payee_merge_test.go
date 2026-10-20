package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func newPayee(t *testing.T, h *apitest.Harness, name string) string {
	t.Helper()
	var out idOnly
	h.MustDo(http.MethodPost, "/api/v1/payees", map[string]string{"name": name}, http.StatusCreated, &out)
	return out.ID
}

func payeeNames(t *testing.T, h *apitest.Harness) map[string]string {
	t.Helper()
	var out struct {
		Items []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/payees?limit=200", nil, http.StatusOK, &out)
	m := map[string]string{}
	for _, p := range out.Items {
		m[p.ID] = p.Name
	}
	return m
}

// A82: a payee is renamed; a name in use is rejected.
func TestRenamePayee(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	ifood := newPayee(t, c.h, "IFOOD")
	newPayee(t, c.h, "Rappi")
	c.h.MustDo(http.MethodPatch, "/api/v1/payees/"+ifood, map[string]string{"name": "iFood"}, http.StatusOK, nil)
	if got := payeeNames(t, c.h)[ifood]; got != "iFood" {
		t.Fatalf("name = %q", got)
	}
	c.h.ExpectProblem(c.h.Do(http.MethodPatch, "/api/v1/payees/"+ifood, map[string]string{"name": "rappi"}), http.StatusUnprocessableEntity, "validation_failed", "name")
}

// A82: transactions move to the destination payee; the source leaves the list.
func TestMergePayees(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	from, into := newPayee(t, c.h, "IFOOD SP"), newPayee(t, c.h, "iFood")
	body := tx("2026-10-01", apitest.Posting(c.checking, -4500), apitest.Posting(c.delivery, 4500))
	body["payee_id"] = from
	var live, voided idOnly
	c.h.MustDo(http.MethodPost, "/api/v1/transactions", body, http.StatusCreated, &live)
	c.h.MustDo(http.MethodPost, "/api/v1/transactions", body, http.StatusCreated, &voided)
	c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided.ID+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)

	c.h.MustDo(http.MethodPost, "/api/v1/payees/"+from+"/merge", map[string]string{"into": into}, http.StatusOK, nil)

	var got struct {
		Version int    `json:"version"`
		PayeeID string `json:"payee_id"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/transactions/"+live.ID, nil, http.StatusOK, &got)
	if got.Version != 2 || got.PayeeID != into {
		t.Fatalf("live transaction = %+v", got)
	}
	c.h.MustDo(http.MethodGet, "/api/v1/transactions/"+voided.ID, nil, http.StatusOK, &got)
	if got.Version != 1 || got.PayeeID != into {
		t.Fatalf("voided transaction = %+v", got)
	}
	names := payeeNames(t, c.h)
	if _, listed := names[from]; listed || names[into] != "iFood" {
		t.Fatalf("payees = %v", names)
	}
}

// Review Focus 4: a payee cannot merge into itself or into a merged payee.
func TestMergePayeeRejections(t *testing.T) {
	t.Parallel()
	c := newCategoryTree(t)
	a, b, d := newPayee(t, c.h, "A"), newPayee(t, c.h, "B"), newPayee(t, c.h, "D")
	c.h.MustDo(http.MethodPost, "/api/v1/payees/"+b+"/merge", map[string]string{"into": d}, http.StatusOK, nil)
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/payees/"+a+"/merge", map[string]string{"into": a}), http.StatusUnprocessableEntity, "validation_failed", "into")
	c.h.ExpectProblem(c.h.Do(http.MethodPost, "/api/v1/payees/"+a+"/merge", map[string]string{"into": b}), http.StatusUnprocessableEntity, "validation_failed", "into")
}
