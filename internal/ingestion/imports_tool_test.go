package ingestion_test

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func toolOutput(t *testing.T, h *apitest.Harness, name string, args map[string]any, out any) {
	t.Helper()
	r := h.Tool(name, args)
	if r.IsError {
		t.Fatalf("%s = error %s", name, r.Content)
	}
	if err := json.Unmarshal(r.Content, out); err != nil {
		t.Fatal(err)
	}
}

func preview(t *testing.T, h *apitest.Harness, name string, args map[string]any) (tool.Preview, tool.Result) {
	t.Helper()
	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}
	p, r, err := h.App.Tools.Preview(auth.WithUserID(t.Context(), h.OwnerID()), name, b)
	if err != nil {
		t.Fatalf("preview %s: %v", name, err)
	}
	return p, r
}

func TestGetImportsToolBatches(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Checking", "asset", "checking", nil)
	b := mustImport(t, h, checking, "ofx", "a.ofx", apitest.OFX("",
		apitest.OFXLine{Date: "20261010", Amount: "-50.00", FITID: "p1", Name: "PIX"},
		apitest.OFXLine{Date: "20261011", Amount: "-20.00", FITID: "p2", Name: "Bakery"}))

	type batch struct {
		BatchID     string         `json:"batch_id"`
		AccountName string         `json:"account_name"`
		Source      string         `json:"source"`
		FileName    string         `json:"file_name"`
		Counts      map[string]int `json:"counts"`
	}
	var got struct {
		Batches []batch `json:"batches"`
	}
	toolOutput(t, h, "get_imports", map[string]any{"view": "batches"}, &got)
	want := []batch{{BatchID: b.ID, AccountName: "Checking", Source: "ofx", FileName: "a.ofx", Counts: map[string]int{"received": 2, "created": 2}}}
	if !reflect.DeepEqual(got.Batches, want) {
		t.Errorf("batches = %+v, want %+v", got.Batches, want)
	}
}

func TestGetImportsToolRecords(t *testing.T) {
	t.Parallel()
	h, batch, record, first, second := ambiguous(t)
	var got struct {
		BatchID     string `json:"batch_id"`
		AccountName string `json:"account_name"`
		Records     []struct {
			RecordID     string     `json:"record_id"`
			Date         string     `json:"date"`
			Description  string     `json:"description"`
			Amount       tool.Money `json:"amount"`
			State        string     `json:"state"`
			ReviewReason string     `json:"review_reason"`
			Candidates   []string   `json:"candidates"`
		} `json:"records"`
	}
	toolOutput(t, h, "get_imports", map[string]any{"view": "records", "batch_id": batch, "state": "needs_review"}, &got)
	if got.BatchID != batch || got.AccountName != "Nubank checking" || len(got.Records) != 1 {
		t.Fatalf("records = %+v", got)
	}
	r := got.Records[0]
	if r.RecordID != record.ID || r.Date != "2026-10-10" || r.Description != "PIX" || r.Amount != (tool.Money{Amount: "-50.00", Currency: "BRL"}) ||
		r.State != "needs_review" || !reflect.DeepEqual(r.Candidates, []string{second, first}) {
		t.Errorf("record = %+v", r)
	}
	h.ExpectToolError(h.Tool("get_imports", map[string]any{"view": "records"}), "invalid_arguments", "batch_id")
	h.ExpectToolError(h.Tool("get_imports", map[string]any{"view": "batches", "batch_id": batch}), "invalid_arguments", "batch_id")
}

func TestGetImportsToolOtherUser(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-05"))
	other := h.LoginAs("other@example.com", locale.Locale{Language: "pt", Region: "BR"}, "BRL")
	var account struct {
		ID string `json:"id"`
	}
	r := h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Theirs", "class": "asset", "kind": "checking", "currency": "BRL"})
	r.Decode(t, &account)
	up := h.UploadAs(other, "/api/v1/accounts/"+account.ID+"/imports", map[string]string{"format": "ofx"}, "b.ofx",
		apitest.OFX("", apitest.OFXLine{Date: "20261010", Amount: "-50.00", FITID: "p1", Name: "PIX"}))
	var b batchView
	up.Decode(t, &b)
	h.ExpectToolError(h.Tool("get_imports", map[string]any{"view": "records", "batch_id": b.ID}), "not_found", "")
	h.ExpectToolError(h.Tool("get_imports", map[string]any{"view": "unconfirmed", "account_id": account.ID}), "not_found", "")
}

// S35 through the assistant: the preview changes nothing; the call resolves once.
func TestManageImportsResolveRecord(t *testing.T) {
	t.Parallel()
	h, batch, record, first, second := ambiguous(t)
	stranger := h.Record("2026-10-10", apitest.Posting(h.Transaction(first).Postings[0].AccountID, -1), apitest.Posting(h.Transaction(first).Postings[1].AccountID, 1))
	_, r := preview(t, h, "manage_imports", map[string]any{"action": "resolve_record", "record_id": record.ID, "resolution": "match", "transaction_id": stranger})
	h.ExpectToolError(r, "validation_failed", "transaction_id")
	h.ExpectToolError(h.Tool("manage_imports", map[string]any{"action": "resolve_record", "record_id": record.ID, "resolution": "discard", "transaction_id": second}), "invalid_arguments", "transaction_id")

	args := map[string]any{"action": "resolve_record", "record_id": record.ID, "resolution": "match", "transaction_id": second}
	p, r := preview(t, h, "manage_imports", args)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}
	want := tool.Preview{Action: "manage_imports.resolve_record", Target: "Bank line PIX of 2026-10-10", Changes: []tool.Change{
		{Field: "status", Before: tool.TextValue("needs_review"), After: tool.TextValue("matched")},
		{Field: "transaction", After: tool.TextValue(second)},
	}}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}
	if q := records(t, h, batch, "needs_review"); len(q) != 1 {
		t.Fatalf("the preview resolved the record: %+v", q)
	}

	var got struct {
		RecordID      string `json:"record_id"`
		State         string `json:"state"`
		TransactionID string `json:"transaction_id"`
	}
	toolOutput(t, h, "manage_imports", args, &got)
	if got.RecordID != record.ID || got.State != "matched" || got.TransactionID != second {
		t.Errorf("resolved = %+v", got)
	}
	var b batchView
	h.MustDo(http.MethodGet, "/api/v1/import-batches/"+batch, nil, http.StatusOK, &b)
	if c := counts(b); c != "received 1 ignored 0 matched 1 created 0 review 0" {
		t.Errorf("batch after resolution: %s", c)
	}
	h.ExpectToolError(h.Tool("manage_imports", args), "record_resolved", "")
}

func TestManageImportsConnections(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "Nubank")
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	conn := a.mustConnect(a.h.Client, in.ID, nubankItem)

	var got struct {
		Connections []struct {
			ConnectionID string `json:"connection_id"`
			Name         string `json:"name"`
			Accounts     []struct {
				ExternalAccountID string `json:"external_account_id"`
			} `json:"accounts"`
		} `json:"connections"`
		Integrations []struct {
			IntegrationID string `json:"integration_id"`
			Name          string `json:"name"`
			Aggregator    string `json:"aggregator"`
		} `json:"integrations"`
	}
	toolOutput(t, a.h, "get_imports", map[string]any{"view": "connections"}, &got)
	if len(got.Connections) != 1 || got.Connections[0].ConnectionID != conn.ID || got.Connections[0].Name != conn.Name ||
		len(got.Connections[0].Accounts) != len(conn.Accounts) {
		t.Errorf("connections = %+v", got.Connections)
	}
	if len(got.Integrations) != 1 || got.Integrations[0].IntegrationID != in.ID || got.Integrations[0].Name != "Meu Pluggy" || got.Integrations[0].Aggregator != "Pluggy" {
		t.Errorf("integrations = %+v", got.Integrations)
	}

	_, r := preview(t, a.h, "manage_imports", map[string]any{"action": "delete_integration", "integration_id": in.ID})
	a.h.ExpectToolError(r, "integration_in_use", "")
	a.h.ExpectToolError(a.h.Tool("manage_imports", map[string]any{"action": "delete_integration", "integration_id": in.ID}), "integration_in_use", "")

	del := map[string]any{"action": "delete_connection", "connection_id": conn.ID}
	p, r := preview(t, a.h, "manage_imports", del)
	if r.IsError || !p.Destructive || p.Target != "Connection "+conn.Name {
		t.Fatalf("preview = %+v, %s", p, r.Content)
	}
	a.h.MustDo(http.MethodGet, "/api/v1/connections/"+conn.ID, nil, http.StatusOK, nil)
	if r := a.h.Tool("manage_imports", del); r.IsError {
		t.Fatalf("delete_connection = error %s", r.Content)
	}
	a.h.ExpectProblem(a.h.Do(http.MethodGet, "/api/v1/connections/"+conn.ID, nil), http.StatusNotFound, "not_found", "")
	a.h.ExpectToolError(a.h.Tool("manage_imports", map[string]any{"action": "sync"}), "invalid_arguments", "connection_id")
}
