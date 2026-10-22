package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type identifierBody struct {
	Scheme     string `json:"scheme"`
	Identifier string `json:"identifier"`
}

// Spec §5.7: an institution names an identifier by scheme; the br_ispb identifier keys its logo (ADR 013).
func TestInstitutionIdentifier(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var created struct {
		ID         string          `json:"id"`
		Name       string          `json:"name"`
		Identifier *identifierBody `json:"identifier"`
	}
	nubank := map[string]any{"name": "Nubank", "identifier": map[string]string{"scheme": "br_ispb", "identifier": "18236120"}}
	h.MustDo(http.MethodPost, "/api/v1/institutions", nubank, http.StatusCreated, &created)
	if created.Name != "Nubank" || created.Identifier == nil || *created.Identifier != (identifierBody{"br_ispb", "18236120"}) {
		t.Fatalf("created = %+v, want Nubank with br_ispb 18236120", created)
	}
	h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Wallet"}, http.StatusCreated, nil)

	var list struct {
		Items []struct {
			Name       string          `json:"name"`
			Identifier *identifierBody `json:"identifier"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/institutions", nil, http.StatusOK, &list)
	if len(list.Items) != 2 || list.Items[0].Name != "Nubank" || list.Items[0].Identifier == nil || *list.Items[0].Identifier != (identifierBody{"br_ispb", "18236120"}) ||
		list.Items[1].Name != "Wallet" || list.Items[1].Identifier != nil {
		t.Fatalf("items = %+v, want Nubank br_ispb 18236120 then Wallet without identifier", list.Items)
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/institutions", map[string]any{"name": "Nu", "identifier": map[string]string{"scheme": "br_ispb", "identifier": "18236120"}}),
		http.StatusUnprocessableEntity, "validation_failed", "identifier")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/institutions", map[string]any{"name": "Inter", "identifier": map[string]string{"scheme": "br_ispb", "identifier": "416968"}}),
		http.StatusUnprocessableEntity, "validation_failed", "identifier")
}

func TestInstitutionIdentifierUpdate(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var inst struct {
		ID         string          `json:"id"`
		Identifier *identifierBody `json:"identifier"`
	}
	h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Mercado Pago"}, http.StatusCreated, &inst)
	path := "/api/v1/institutions/" + inst.ID + "/identifier"

	h.MustDo(http.MethodPut, path, map[string]string{"scheme": "bic", "identifier": "BOFAUS3NXXX"}, http.StatusOK, &inst)
	if inst.Identifier == nil || *inst.Identifier != (identifierBody{"bic", "BOFAUS3NXXX"}) {
		t.Fatalf("identifier = %+v, want bic BOFAUS3NXXX", inst.Identifier)
	}
	var got struct {
		Items []struct {
			Identifier *identifierBody `json:"identifier"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/institutions", nil, http.StatusOK, &got)
	if len(got.Items) != 1 || got.Items[0].Identifier == nil || *got.Items[0].Identifier != (identifierBody{"bic", "BOFAUS3NXXX"}) {
		t.Fatalf("items = %+v, want bic BOFAUS3NXXX", got.Items)
	}

	h.ExpectProblem(h.Do(http.MethodPut, path, map[string]string{"scheme": "bic", "identifier": "BOFA"}),
		http.StatusUnprocessableEntity, "validation_failed", "identifier")
	h.ExpectProblem(h.Do(http.MethodPut, path, map[string]string{"scheme": "xx_yy", "identifier": "1"}),
		http.StatusUnprocessableEntity, "validation_failed", "scheme")

	var second struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Other"}, http.StatusCreated, &second)
	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/institutions/"+second.ID+"/identifier", map[string]string{"scheme": "bic", "identifier": "BOFAUS3NXXX"}),
		http.StatusUnprocessableEntity, "validation_failed", "identifier")

	h.ExpectProblem(h.Do(http.MethodPut, "/api/v1/institutions/0190b8a0-0000-7000-8000-000000000000/identifier", map[string]string{"scheme": "bic", "identifier": "BOFAUS3N"}),
		http.StatusNotFound, "not_found", "")
}

func TestInstitutionIdentifierSchemes(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var out struct {
		Items []struct {
			ID      string `json:"id"`
			Pattern string `json:"pattern"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/institution-identifier-schemes", nil, http.StatusOK, &out)
	want := []struct{ ID, Pattern string }{
		{"bic", "^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$"},
		{"br_ispb", "^[0-9]{8}$"},
	}
	if len(out.Items) != len(want) {
		t.Fatalf("items = %+v, want %+v", out.Items, want)
	}
	for i, w := range want {
		if out.Items[i].ID != w.ID || out.Items[i].Pattern != w.Pattern {
			t.Fatalf("item %d = %+v, want %+v", i, out.Items[i], w)
		}
	}
}
