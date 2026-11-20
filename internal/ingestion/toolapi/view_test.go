package toolapi_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

// Two batches: 48 lines created, 5 waiting for review in all.
func TestViewImports(t *testing.T) {
	out := `{"batches":[{"batch_id":"b1","account_name":"Itaú","source":"ofx","file_name":"out.ofx","started_at":"2026-11-19T10:00:00Z",
		"counts":{"received":56,"created":48,"ignored":3,"needs_review":5}},
		{"batch_id":"b2","account_name":"Nubank","source":"ofx","started_at":"2026-11-18T10:00:00Z","counts":{"received":10,"matched":10}}]}`

	b := toolapi.Views()[view.Key{Tool: "get_imports", Form: "imports"}]

	p, err := b(
		[]json.RawMessage{json.RawMessage(out)},
		view.Select{},
		time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatal(err)
	}

	if p.Verdict.Key != "assistantView.imports.verdict" || *p.Verdict.Params["count"].Count != 2 ||
		*p.Verdict.Params["review"].Count != 5 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}
