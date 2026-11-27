package ledger_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// S763 (investment history AS3): import_investment_file previews the counts of a dry run and
// records the file of S760 when confirmed.
func TestS763InvestmentFileThroughAssistant(t *testing.T) {
	t.Parallel()
	f := newInvestmentFileFixture(t, apitest.Brazil(), "HGLG11", "reit", 1000000)
	file := investmentFile(
		"opening,2021-03-10,PETR4,100,20.00,5.00,,,,",
		"buy,2026-11-03,HGLG11,10,160.00,1.00,,,,",
		"sell,2026-11-10,PETR4,40,30.00,,0.06,,,",
		"income,2026-11-14,HGLG11,,,,,11.00,,distribution",
	)

	r := f.h.Upload("/api/v1/assistant/files", "operations.csv", []byte(file))
	if r.Status != http.StatusCreated {
		t.Fatalf("upload status %d: %s", r.Status, r.Body)
	}

	var uploaded struct {
		ID string `json:"id"`
	}
	r.Decode(t, &uploaded)

	args := map[string]any{
		"file_id":      uploaded.ID,
		"brokerage_id": f.xp,
		"category_id":  f.category,
	}

	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}

	ctx := auth.WithIdentity(
		t.Context(),
		f.h.MemberIDOf("owner@example.com"),
		f.h.BooksIDOf("owner@example.com"),
		auth.RoleOwner,
	)

	p, res, err := f.h.App.Tools.Preview(ctx, "import_investment_file", b)
	if err != nil || res.IsError {
		t.Fatalf("preview = %v, %s", err, res.Content)
	}

	if p.Action != "import_investment_file" {
		t.Errorf("action = %q", p.Action)
	}

	got := map[string]string{}
	for _, c := range p.Changes {
		got[c.Field] = c.After.Text
	}

	want := map[string]string{
		"file": "operations.csv", "brokerage": "XP", "lines": "4", "created": "4", "skipped": "0",
	}
	for field, value := range want {
		if got[field] != value {
			t.Errorf("change %s = %q, want %q (changes %+v)", field, got[field], value, p.Changes)
		}
	}

	f.expectTrades(t, "0")

	res = f.h.Tool("import_investment_file", args)
	if res.IsError {
		t.Fatalf("import_investment_file = %s", res.Content)
	}

	var out investmentFileResult
	if err := json.Unmarshal(res.Content, &out); err != nil {
		t.Fatal(err)
	}

	if want := (investmentFileResult{Lines: 4, Created: 4}); out != want {
		t.Errorf("result = %+v, want %+v", out, want)
	}

	f.expectCash(t, "960994")
	f.expectTrades(t, "3")
}
