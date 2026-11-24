package ingestion_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Every item of one aggregator connector has the connector's name, so the owner names the bank.
func TestRenameConnection(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "MeuPluggy")
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	conn := a.mustConnect(a.h.Client, in.ID, nubankItem)
	path := "/api/v1/connections/" + conn.ID

	var renamed connectionView
	a.h.MustDo(http.MethodPatch, path, map[string]any{"name": "  Nubank "}, http.StatusOK, &renamed)

	if renamed.Name != "Nubank" || len(renamed.Accounts) != len(conn.Accounts) {
		t.Errorf("renamed = %+v", renamed)
	}

	if got := a.connection(a.h.Client, conn.ID); got.Name != "Nubank" {
		t.Errorf("name = %q", got.Name)
	}

	a.h.ExpectProblem(
		a.h.Do(http.MethodPatch, path, map[string]any{"name": "   "}),
		http.StatusUnprocessableEntity, "validation_failed", "name",
	)
	a.h.ExpectProblem(
		a.h.Do(http.MethodPatch, "/api/v1/connections/01990000-0000-7000-8000-000000000000",
			map[string]any{"name": "Nubank"}),
		http.StatusNotFound, "not_found", "",
	)

	body := map[string]any{"name": "Other"}

	reader := a.h.JoinAs("reader@example.com", a.h.OwnerID(), "read")
	if r := a.h.Call(reader, http.MethodPatch, path, body); r.Status != http.StatusForbidden {
		t.Errorf("reader status %d: %s", r.Status, r.Body)
	}

	stranger := a.h.Login("stranger@example.com")
	if r := a.h.Call(stranger, http.MethodPatch, path, body); r.Status != http.StatusNotFound {
		t.Errorf("stranger status %d: %s", r.Status, r.Body)
	}

	if got := a.connection(a.h.Client, conn.ID); got.Name != "Nubank" {
		t.Errorf("name after refusals = %q", got.Name)
	}

	writer := a.h.JoinAs("writer@example.com", a.h.OwnerID(), "write")
	if r := a.h.Call(writer, http.MethodPatch, path, body); r.Status != http.StatusOK {
		t.Errorf("writer status %d: %s", r.Status, r.Body)
	}
}

func TestRenameConnectionTool(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "MeuPluggy")
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	conn := a.mustConnect(a.h.Client, in.ID, nubankItem)
	args := map[string]any{
		"action": "rename_connection", "connection_id": conn.ID, "name": "Nubank",
	}

	p, _ := preview(t, a.h, "manage_imports", args)
	if p.Target != "MeuPluggy" || p.Destructive || len(p.Changes) != 1 ||
		p.Changes[0].Before != tool.TextValue("MeuPluggy") ||
		p.Changes[0].After != tool.TextValue("Nubank") {
		t.Errorf("preview = %+v", p)
	}

	if r := a.h.Tool("manage_imports", args); r.IsError {
		t.Fatalf("rename_connection = error %s", r.Content)
	}

	if got := a.connection(a.h.Client, conn.ID); got.Name != "Nubank" {
		t.Errorf("name = %q", got.Name)
	}

	args["name"] = strings.Repeat("x", 61)
	a.h.ExpectToolError(a.h.Tool("manage_imports", args), "validation_failed", "name")

	delete(args, "name")
	if r := a.h.Tool("manage_imports", args); !r.IsError {
		t.Errorf("rename without a name = %s", r.Content)
	}
}
