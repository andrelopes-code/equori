package toolapi_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

func TestViewCalculator(t *testing.T) {
	b := toolapi.Views()[view.Key{Tool: "open_calculator", Form: "calculator"}]

	p, err := b(
		[]json.RawMessage{
			json.RawMessage(
				`{"path":"/calculators/fixed-income?rate=110&amount=10000","title":"Fixed income"}`,
			),
		},
		view.Select{},
		time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatal(err)
	}

	if p.Open.Screen != "/calculators/fixed-income" || p.Open.Params["rate"] != "110" ||
		len(p.Rows.Rows) != 2 ||
		p.Rows.Rows[0][0].Text != "amount" {
		t.Fatalf("payload = %+v", p)
	}
}
