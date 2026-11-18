package marketdata_test

import (
	"encoding/json"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// Coverage row F-16 (assistant parity design, phase 6): a CRI with monthly interest and an
// irregular amortization gets its explicit payment dates through the assistant, as the payments
// field of putInstrumentTerms sets them; the other terms stay.
func TestSetPaymentScheduleTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	defineFixedIncome(t, h, "CRIXPTO")

	toolOutput(t, h, "manage_instrument", map[string]any{
		"action":      "set_terms",
		"code":        "CRIXPTO",
		"issued_on":   "2026-01-02",
		"matures_on":  "2027-01-04",
		"face_value":  "1000.00",
		"index_id":    "ipca",
		"spread_bp":   650,
		"day_count":   "bus252",
		"calendar_id": "br_banking",
	}, &struct{}{})

	args := map[string]any{"code": "CRIXPTO", "payments": []any{
		map[string]any{"pays_on": "2026-02-02", "amortization_bp": 1000, "pays_interest": true},
		map[string]any{"pays_on": "2026-03-02", "amortization_bp": 0, "pays_interest": true},
		map[string]any{"pays_on": "2026-04-01", "amortization_bp": 2500, "pays_interest": true},
		map[string]any{"pays_on": "2027-01-04", "amortization_bp": 6500, "pays_interest": true},
	}}

	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}

	p, r, err := h.App.Tools.Preview(
		h.WithIdentity("owner@example.com", auth.RoleOwner),
		"set_payment_schedule",
		b,
	)
	if err != nil || r.IsError || len(p.Changes) != 1 || p.Changes[0].Field != "terms" ||
		p.Changes[0].After.Text != "4 payments from 2026-02-02 to 2027-01-04, amortization 100.00%" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}

	toolOutput(t, h, "set_payment_schedule", args, &struct{}{})

	var got struct {
		Instrument toolInstrument `json:"instrument"`
	}
	toolOutput(
		t,
		h,
		"get_market_data",
		map[string]any{"view": "instrument", "code": "CRIXPTO"},
		&got,
	)

	terms := got.Instrument.Terms
	if len(terms.Payments) != 4 || terms.Payments[2].PaysOn != "2026-04-01" ||
		terms.Payments[2].AmortizationBP != 2500 || terms.Payments[1].AmortizationBP != 0 {
		t.Errorf("payments = %+v", terms.Payments)
	}

	if terms.IndexID != "ipca" || terms.DayCount != "bus252" || terms.MaturesOn != "2027-01-04" {
		t.Errorf("terms = %+v, want the IPCA terms kept", terms)
	}

	h.JoinAs("reader@example.com", h.OwnerID(), "read")
	h.ExpectToolError(
		h.ToolAs("reader@example.com", auth.RoleRead, "set_payment_schedule", args),
		"book_role_required",
		"",
	)
	h.ExpectToolError(
		h.Tool("set_payment_schedule", map[string]any{"code": "CRIXPTO", "payments": []any{
			map[string]any{"pays_on": "2028-01-03", "amortization_bp": 0, "pays_interest": true},
		}}),
		"validation_failed",
		"",
	)
}
