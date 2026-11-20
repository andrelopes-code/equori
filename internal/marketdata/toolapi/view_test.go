package toolapi_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

func build(t *testing.T, tool, form, out string) view.Payload {
	t.Helper()

	b := toolapi.Views()[view.Key{Tool: tool, Form: form}]

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

// Basel 13.2% against 10.5%, principal capital 9.1% against 8.5%: the principal capital is the
// tightest, 0.6 points above; the fixed asset ratio has no minimum in the read.
func TestViewInstitution(t *testing.T) {
	p := build(
		t,
		"get_institution_indicators",
		"institution",
		`{"source":"bcb","source_url":"","conglomerate_name":"Banco Aurora","rule":"r",
		"basel_minimum":"0.08","basel_with_buffer":"0.105","principal_capital_minimum":"0.06","principal_capital_with_buffer":"0.085",
		"periods":[{"period":"2026-06-30","basel":"0.132","principal_capital":"0.091","fixed_asset":"0.22"}]}`,
	)

	var d struct {
		Rows []struct {
			Kind    string `json:"kind"`
			ValueBP int64  `json:"value_bp"`
			LimitBP *int64 `json:"limit_bp"`
		} `json:"rows"`
	}
	b, _ := json.Marshal(p.Data)
	_ = json.Unmarshal(b, &d)

	if len(d.Rows) != 3 || d.Rows[0].ValueBP != 1320 || *d.Rows[0].LimitBP != 1050 ||
		d.Rows[2].LimitBP != nil {
		t.Fatalf("data = %+v", d)
	}

	if p.Verdict.Key != "assistantView.institution.verdict_above" ||
		*p.Verdict.Params["gap"].Points != 60 ||
		p.Verdict.Params["name"].Text != "assistantView.institution.principal_capital" {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}

// PETR4 from 34.20 to 38.92: up 13.8%.
func TestViewPrice(t *testing.T) {
	p := build(
		t,
		"get_market_data",
		"price",
		`{"instrument":{"code":"PETR4","name":"Petrobras","type":"stock"},
		"prices":[{"date":"2026-03-02","value":"34.20"},{"date":"2026-07-01","value":"36.10"},{"date":"2026-11-18","value":"38.92"}]}`,
	)

	if p.Verdict.Key != "assistantView.price.verdict" || *p.Verdict.Params["change"].Rate != 1380 {
		t.Fatalf("verdict = %+v", p.Verdict)
	}
}
