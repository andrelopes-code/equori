package toolapi_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/classification/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

func build(t *testing.T, form, out string) view.Payload {
	t.Helper()

	b := toolapi.Views()[view.Key{Tool: "explain_categorization", Form: form}]

	p, err := b(
		[]json.RawMessage{json.RawMessage(out)},
		view.Select{},
		time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatal(err)
	}

	return p
}

func TestViewExplain(t *testing.T) {
	p := build(
		t,
		"explain",
		`{"items":[{"transaction_id":"t1","method":"rule","rule_name":"MERCADOLIVRE*","decided_at":"2026-11-16T10:00:00Z"}]}`,
	)
	if p.Verdict.Key != "assistantView.explain.verdict_rule" ||
		p.Verdict.Params["rule"].Text != "MERCADOLIVRE*" {
		t.Fatalf("verdict = %+v", p.Verdict)
	}

	none := build(
		t,
		"explain",
		`{"items":[{"transaction_id":"t2","decided_at":"2026-11-16T10:00:00Z"}]}`,
	)
	if none.Verdict.Key != "assistantView.explain.verdict_uncategorized" {
		t.Fatalf("verdict = %+v", none.Verdict)
	}
}

// 200 transactions: 150 by a rule, 20 from the bank, 10 by history, 15 by hand, 5 waiting.
func TestViewCategorization(t *testing.T) {
	p := build(
		t,
		"categorization",
		`{"statistics":{"from":"2026-10-01","to":"2026-10-31","total":200,"rule":150,"source":20,"history":10,"manual":15,"uncategorized":5}}`,
	)

	if p.Verdict.Key != "assistantView.categorization.verdict" ||
		*p.Verdict.Params["share"].BP != 9000 ||
		*p.Verdict.Params["open"].Count != 5 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}
