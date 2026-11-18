package ledger_test

import (
	"testing"
)

// TestRecordFixedIncomeCDIPlusSpread records a contract that pays the CDI plus 1.5% a year, the
// usual rate form of a debenture, a CRI and a CRA: a daily index takes a spread as a monthly
// one does (product matrix row F-04).
func TestRecordFixedIncomeCDIPlusSpread(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	args := f.fixedIncomeToolArgs()
	args["subtype"] = "debenture"
	args["percent_of_index"] = "100"
	args["spread"] = "1.5"

	p := previewTool(t, f.h, "record_fixed_income", args)
	if p.Target != "DEBENTURE Banco X 2028-03-02 · CDI + 1.5% · matures 2028-03-02" {
		t.Fatalf("target = %q", p.Target)
	}

	var out fixedIncomeToolOut
	toolOutput(t, f.h, "record_fixed_income", args, &out)

	rows := f.h.Rows(
		`SELECT index_id, percent_of_index_bp, spread_bp, day_count
		 FROM marketdata_fixed_income_terms WHERE instrument_code = $1`,
		out.Instrument,
	)
	if len(rows) != 1 || rows[0] != "cdi 10000 150 bus252" {
		t.Fatalf("terms = %v, want cdi 10000 150 bus252", rows)
	}
}
