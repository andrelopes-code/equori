package ledger_test

import (
	"strings"
	"testing"
)

type fixedIncomeToolOut struct {
	Instrument    string `json:"instrument"`
	TransactionID string `json:"transaction_id"`
	Quantity      string `json:"quantity"`
	UnitPrice     string `json:"unit_price"`
}

func TestRecordFixedIncomeS479(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	args := f.fixedIncomeToolArgs()

	p := previewTool(t, f.h, "record_fixed_income", args)
	if p.Target != "CDB Banco X 2028-03-02 · 110% of CDI · matures 2028-03-02" {
		t.Fatalf("line 1 = %q", p.Target)
	}

	if len(p.Changes) != 3 || p.Changes[0].Field != "amount" ||
		p.Changes[0].After.Amount != "10000.00" || p.Changes[1].Field != "account" ||
		p.Changes[1].After.Text != "XP cash" || p.Changes[2].Field != "date" ||
		p.Changes[2].After.Date != "2026-03-02" {
		t.Fatalf("line 2 = %+v", p.Changes)
	}

	var out fixedIncomeToolOut
	toolOutput(t, f.h, "record_fixed_income", args, &out)

	if !strings.HasPrefix(out.Instrument, "RF.") || out.Quantity != "10000.000000" ||
		out.UnitPrice != "1.000000000000" {
		t.Fatalf("result = %+v", out)
	}

	got := amountsByAccount(f.h.Transaction(out.TransactionID))
	if got[f.cash] != -1000000 {
		t.Fatalf("postings = %v", got)
	}
}

func TestRecordFixedIncomeRates(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)

	tests := []struct {
		name  string
		extra map[string]any
		want  string
	}{
		{"percent in basis points", map[string]any{"percent_of_index": "110.5"},
			"CDB Banco X 2028-03-02 · 110.5% of CDI · matures 2028-03-02"},
		{"index plus spread", map[string]any{"index_id": "ipca", "spread": "6.5"},
			"CDB Banco X 2028-03-02 · IPCA + 6.5% · matures 2028-03-02"},
		{"pre-fixed", map[string]any{"index_id": "", "spread": "12"},
			"CDB Banco X 2028-03-02 · 12% a year · matures 2028-03-02"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			args := f.fixedIncomeToolArgs()
			delete(args, "percent_of_index")

			for k, v := range tt.extra {
				args[k] = v
			}

			if p := previewTool(t, f.h, "record_fixed_income", args); p.Target != tt.want {
				t.Fatalf("line 1 = %q, want %q", p.Target, tt.want)
			}
		})
	}
}

// A236 FC16: amortizations are sent as payment rows without interest.
func TestRecordFixedIncomeAmortizations(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	args := f.fixedIncomeToolArgs()
	args["amortizations"] = []map[string]any{{"pays_on": "2027-03-02", "percent": "50"}}

	var out fixedIncomeToolOut
	toolOutput(t, f.h, "record_fixed_income", args, &out)

	var terms struct {
		Payments []struct {
			PaysOn         string `json:"pays_on"`
			AmortizationBP int    `json:"amortization_bp"`
			PaysInterest   bool   `json:"pays_interest"`
		} `json:"payments"`
	}

	f.h.MustDo("GET", "/api/v1/instruments/"+out.Instrument+"/terms", nil, 200, &terms)

	if len(terms.Payments) != 1 || terms.Payments[0].PaysOn != "2027-03-02" ||
		terms.Payments[0].AmortizationBP != 5000 || terms.Payments[0].PaysInterest {
		t.Fatalf("payments = %+v", terms.Payments)
	}
}

// Task 3 amendment: amortizations merge by date with the interest schedule.
func TestRecordFixedIncomeAmortizationsWithInterest(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	args := f.fixedIncomeToolArgs()
	args["interest_every_months"] = 6
	args["first_payment_on"] = "2026-09-02"
	args["amortizations"] = []map[string]any{{"pays_on": "2027-03-02", "percent": "50"}}

	var out fixedIncomeToolOut
	toolOutput(t, f.h, "record_fixed_income", args, &out)

	var terms struct {
		Payments []struct {
			PaysOn         string `json:"pays_on"`
			AmortizationBP int    `json:"amortization_bp"`
			PaysInterest   bool   `json:"pays_interest"`
		} `json:"payments"`
	}

	f.h.MustDo("GET", "/api/v1/instruments/"+out.Instrument+"/terms", nil, 200, &terms)

	if len(terms.Payments) != 4 || terms.Payments[1].PaysOn != "2027-03-02" ||
		terms.Payments[1].AmortizationBP != 5000 || !terms.Payments[1].PaysInterest ||
		terms.Payments[0].AmortizationBP != 0 {
		t.Fatalf("payments = %+v", terms.Payments)
	}
}

func TestRecordFixedIncomeInvalidRate(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	args := f.fixedIncomeToolArgs()
	args["percent_of_index"] = "110.555"

	r := f.h.Tool("record_fixed_income", args)
	f.h.ExpectToolError(r, "invalid_arguments", "percent_of_index")

	if !strings.Contains(string(r.Content), "must have at most 2 decimals") {
		t.Fatalf("content = %s", r.Content)
	}
}

func (f investFixture) fixedIncomeToolArgs() map[string]any {
	return map[string]any{
		"brokerage_id":     f.xp,
		"cash_account_id":  f.cash,
		"applied_on":       "2026-03-02",
		"amount":           "10000.00",
		"subtype":          "cdb",
		"issuer":           "Banco X",
		"matures_on":       "2028-03-02",
		"index_id":         "cdi",
		"percent_of_index": "110",
	}
}
