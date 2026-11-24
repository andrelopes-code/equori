package ingestion_test

import (
	"net/http"
	"testing"
	"testing/fstest"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// The token opens the aggregator's own connect dialog; the credentials stay on the server (ADR 039).
func TestConnectToken(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	path := "/api/v1/integrations/" + in.ID + "/connect-token"

	r := a.h.Do(http.MethodPost, path, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("connect token status %d: %s", r.Status, r.Body)
	}

	var out struct {
		Token string `json:"token"`
	}
	r.Decode(t, &out)

	if out.Token != "connect-"+pluggyClient {
		t.Errorf("token = %q", out.Token)
	}

	assertNoSecrets(t, a.h, out.Token)

	unknown := "/api/v1/integrations/01990000-0000-7000-8000-000000000000/connect-token"
	if r := a.h.Do(http.MethodPost, unknown, nil); r.Status != http.StatusNotFound {
		t.Errorf("unknown integration status %d: %s", r.Status, r.Body)
	}

	reader := a.h.JoinAs("reader@example.com", a.h.OwnerID(), "read")
	if r := a.h.Call(reader, http.MethodPost, path, nil); r.Status != http.StatusForbidden {
		t.Errorf("reader status %d: %s", r.Status, r.Body)
	}

	writer := a.h.JoinAs("writer@example.com", a.h.OwnerID(), "write")
	if r := a.h.Call(writer, http.MethodPost, path, nil); r.Status != http.StatusOK {
		t.Errorf("writer status %d: %s", r.Status, r.Body)
	}

	stranger := a.h.Login("stranger@example.com")
	if r := a.h.Call(stranger, http.MethodPost, path, nil); r.Status != http.StatusNotFound {
		t.Errorf("stranger status %d: %s", r.Status, r.Body)
	}

	a.p.FailNext(http.StatusBadRequest, 1)

	if r := a.h.Do(http.MethodPost, path, nil); r.Status != http.StatusBadGateway {
		t.Errorf("aggregator failure status %d: %s", r.Status, r.Body)
	}
}

// Without a secret key no aggregator exists and the pages embed no origin (ADR 039).
func TestPagesEmbedOnlyTheAggregatorDialog(t *testing.T) {
	t.Parallel()
	a := newAggregator(
		t,
		apitest.Web(fstest.MapFS{"index.html": {Data: []byte("<!doctype html>")}}),
	)

	want := "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; " +
		"form-action 'self'; frame-src https://connect.pluggy.ai"
	if got := a.h.Do(
		http.MethodGet,
		"/accounts",
		nil,
	).Header.Get(
		"Content-Security-Policy",
	); got != want {
		t.Errorf("page policy = %q, want %q", got, want)
	}
}
