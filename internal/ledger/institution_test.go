package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// ADR 013: an institution names its ISPB, the key of its logo in the bundled catalogue.
func TestInstitutionISPB(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var created struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		ISPB string `json:"ispb"`
	}
	h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Nubank", "ispb": "18236120"}, http.StatusCreated, &created)
	if created.Name != "Nubank" || created.ISPB != "18236120" {
		t.Fatalf("created = %+v, want Nubank with ISPB 18236120", created)
	}
	h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Wallet"}, http.StatusCreated, nil)

	var list struct {
		Items []struct {
			Name string  `json:"name"`
			ISPB *string `json:"ispb"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/institutions", nil, http.StatusOK, &list)
	if len(list.Items) != 2 || list.Items[0].Name != "Nubank" || list.Items[0].ISPB == nil || *list.Items[0].ISPB != "18236120" ||
		list.Items[1].Name != "Wallet" || list.Items[1].ISPB != nil {
		t.Fatalf("items = %+v, want Nubank 18236120 then Wallet without ISPB", list.Items)
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Nu", "ispb": "18236120"}),
		http.StatusUnprocessableEntity, "validation_failed", "ispb")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Inter", "ispb": "416968"}),
		http.StatusBadRequest, "invalid_request", "ispb")
}

// ADR 013: an institution created before its ISPB was known receives it, and loses it on null.
func TestInstitutionISPBUpdate(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var inst struct {
		ID   string  `json:"id"`
		ISPB *string `json:"ispb"`
	}
	h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Mercado Pago"}, http.StatusCreated, &inst)
	h.MustDo(http.MethodPut, "/api/v1/institutions/"+inst.ID+"/ispb", map[string]any{"ispb": "10573521"}, http.StatusOK, &inst)
	if inst.ISPB == nil || *inst.ISPB != "10573521" {
		t.Fatalf("ispb = %v, want 10573521", inst.ISPB)
	}
	var cleared map[string]any
	h.MustDo(http.MethodPut, "/api/v1/institutions/"+inst.ID+"/ispb", map[string]any{"ispb": nil}, http.StatusOK, &cleared)
	if _, ok := cleared["ispb"]; ok {
		t.Fatalf("cleared = %v, want no ispb", cleared)
	}
	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/institutions/0190b8a0-0000-7000-8000-000000000000/ispb", map[string]any{"ispb": nil}),
		http.StatusNotFound, "not_found", "")
}
