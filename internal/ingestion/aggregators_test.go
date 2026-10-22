package ingestion_test

import (
	"net/http"
	"reflect"
	"testing"
)

type aggregatorView struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	CredentialFields []struct {
		Name   string `json:"name"`
		Secret bool   `json:"secret"`
	} `json:"credential_fields"`
	ConnectMethod string `json:"connect_method"`
}

func TestAggregators(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)

	var list struct {
		Items []aggregatorView `json:"items"`
	}
	a.h.MustDo(http.MethodGet, "/api/v1/aggregators", nil, http.StatusOK, &list)
	if len(list.Items) != 1 {
		t.Fatalf("items = %+v", list.Items)
	}
	got := list.Items[0]
	if got.ID != "pluggy" || got.Name != "Pluggy" || got.ConnectMethod != "reference" {
		t.Fatalf("aggregator = %+v", got)
	}
	type field struct {
		Name   string
		Secret bool
	}
	var fields []field
	for _, f := range got.CredentialFields {
		fields = append(fields, field{f.Name, f.Secret})
	}
	if want := []field{{"client_id", false}, {"client_secret", true}}; !reflect.DeepEqual(fields, want) {
		t.Fatalf("fields = %+v, want %+v", fields, want)
	}
}

func TestIntegrationCredentialFields(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	missing := map[string]any{"aggregator": "pluggy", "name": "Meu Pluggy", "credentials": map[string]any{"client_id": "a"}}
	a.h.ExpectProblem(a.h.Do(http.MethodPost, "/api/v1/integrations", missing),
		http.StatusUnprocessableEntity, "validation_failed", "credentials.client_secret")

	extra := map[string]any{"aggregator": "pluggy", "name": "Meu Pluggy", "credentials": map[string]any{"client_id": "a", "client_secret": "b", "x": "1"}}
	a.h.ExpectProblem(a.h.Do(http.MethodPost, "/api/v1/integrations", extra),
		http.StatusUnprocessableEntity, "validation_failed", "credentials.x")

	unknown := map[string]any{"aggregator": "plaid", "name": "Plaid", "credentials": map[string]any{"client_id": "a", "client_secret": "b"}}
	a.h.ExpectProblem(a.h.Do(http.MethodPost, "/api/v1/integrations", unknown),
		http.StatusUnprocessableEntity, "validation_failed", "aggregator")
}
