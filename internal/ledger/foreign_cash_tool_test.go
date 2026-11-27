package ledger_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// S767 (FC17): record_investment takes exchange_rate, previews it with the gross in the cash
// currency and the cost in the base currency, then records the trade at that rate.
func TestForeignCashThroughAssistant(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)
	args := map[string]any{
		"kind": "buy", "brokerage_id": f.brokerage, "instrument": "VOO",
		"cash_account_id": f.cash, "date": "2026-03-03", "quantity": "10",
		"unit_price": "500.00", "fees": "1.00", "exchange_rate": "5.20",
	}

	p := previewTool(t, f.h, "record_investment", args)

	want := map[string]string{
		"exchange_rate": "5.20",
		"amount":        "5000.00 USD",
		"base_amount":   "26005.20 BRL",
	}
	for field, value := range want {
		if got := changeText(p.Changes, field); got != value {
			t.Errorf("change %s = %q, want %q (changes %+v)", field, got, value, p.Changes)
		}
	}

	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)

	f.expectRows(t, tradeRowSQL, "buy 2600000 520 0 0 0 0 BRL 5.200000000000")
}

// FC17: record_brokerage_note and record_fixed_income take exchange_rate and preview the base
// amount.
func TestForeignCashNoteAndFixedIncomeThroughAssistant(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)

	note := previewTool(t, f.h, "record_brokerage_note", map[string]any{
		"brokerage_id": f.brokerage, "cash_account_id": f.cash, "date": "2026-03-03",
		"fees": "2.00", "exchange_rate": "5.20",
		"orders": []map[string]any{
			{"side": "buy", "instrument": "VOO", "quantity": "10", "unit_price": "500.00"},
		},
	})
	fixed := previewTool(t, f.h, "record_fixed_income", map[string]any{
		"brokerage_id": f.brokerage, "cash_account_id": f.cash, "applied_on": "2026-03-03",
		"amount": "1000.00", "exchange_rate": "5.20", "issuer": "Bank X",
		"subtype": "cdb", "matures_on": "2028-03-03", "index_id": "cdi",
		"percent_of_index": "110",
	})

	for name, c := range map[string]struct {
		changes []tool.Change
		want    string
	}{
		"note":  {note.Changes, "26010.40 BRL"},
		"fixed": {fixed.Changes, "5200.00 BRL"},
	} {
		if got := changeText(c.changes, "base_amount"); got != c.want {
			t.Errorf("%s base_amount = %q, want %q", name, got, c.want)
		}

		if got := changeText(c.changes, "exchange_rate"); got != "5.20" {
			t.Errorf("%s exchange_rate = %q, want 5.20", name, got)
		}
	}
}

// FC3, FC4: base_amount is the sum of the amounts converted one by one, the weight of the cash
// posting: 0.50 and 0.01 at 5.01 give 2.50 + 0.05, where their sum converted at once gives 2.56.
func TestForeignCashBaseAmountIsThePostingWeight(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)
	args := map[string]any{
		"kind": "buy", "brokerage_id": f.brokerage, "instrument": "VOO",
		"cash_account_id": f.cash, "date": "2026-03-03", "quantity": "1",
		"unit_price": "0.50", "fees": "0.01", "exchange_rate": "5.01",
	}

	p := previewTool(t, f.h, "record_investment", args)

	if got := changeText(p.Changes, "base_amount"); got != "2.55 BRL" {
		t.Fatalf("base_amount = %q, want 2.55 BRL", got)
	}

	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)

	f.expectRows(t, f.cashPostings(), "-51 -255")
}

// FC2, FC17: without exchange_rate the preview states the stored close of the date, or is refused
// as the record is.
func TestForeignCashPreviewTakesTheRateOfTheDay(t *testing.T) {
	t.Parallel()
	f := newForeignCashFixture(t)
	args := map[string]any{
		"kind": "buy", "brokerage_id": f.brokerage, "instrument": "VOO",
		"cash_account_id": f.cash, "date": "2026-03-03", "quantity": "10",
		"unit_price": "500.00", "fees": "1.00",
	}

	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}

	ctx := auth.WithBooksID(t.Context(), f.h.OwnerID())

	_, res, _ := f.h.App.Tools.Preview(ctx, "record_investment", b)
	if !res.IsError || !strings.Contains(string(mustJSON(t, res.Content)), "price_missing") {
		t.Fatalf("preview without a stored rate = %s", mustJSON(t, res.Content))
	}

	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument": "USD", "quote_instrument": "BRL", "date": "2026-03-03", "value": "5.10",
	}, http.StatusCreated, nil)

	p := previewTool(t, f.h, "record_investment", args)

	if got := changeText(p.Changes, "exchange_rate"); got != "5.1" {
		t.Errorf("exchange_rate = %q, want 5.1", got)
	}

	if got := changeText(p.Changes, "base_amount"); got != "25505.10 BRL" {
		t.Errorf("base_amount = %q, want 25505.10 BRL", got)
	}
}

func changeText(changes []tool.Change, field string) string {
	for _, c := range changes {
		if c.Field != field {
			continue
		}

		if c.After.Amount != "" {
			return c.After.Amount + " " + c.After.Currency
		}

		return c.After.Text
	}

	return ""
}
