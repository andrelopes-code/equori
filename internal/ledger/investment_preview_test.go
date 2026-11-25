package ledger_test

import (
	"maps"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// TestRecordInvestmentPreviewMoney: the net is what the cash account pays or receives
// (investment proposals design, IP1, IP5).
func TestRecordInvestmentPreviewMoney(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-03", nil)

	tests := []struct {
		name  string
		extra map[string]any
		net   string
	}{
		{"buy with fees", map[string]any{"kind": "buy", "fees": "4.90"}, "-3004.90"},
		{"buy without fees", map[string]any{"kind": "buy"}, "-3000.00"},
		{
			"sell with fees and taxes",
			map[string]any{"kind": "sell", "fees": "4.90", "taxes": "0.15"},
			"2994.95",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			args := f.petr4ToolArgs("2026-11-19", tt.extra)
			expectFields(t, previewTool(t, f.h, "record_investment", args), map[string]string{
				"amount":  "3000.00",
				"net":     tt.net,
				"account": "XP cash",
			})
		})
	}
}

// TestRecordInvestmentPreviewCashAmbiguous: two candidates leave the account out (IP5).
func TestRecordInvestmentPreviewCashAmbiguous(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.Account("XP cash 2", "asset", "brokerage", map[string]any{
		"institution_id": f.institution, "parent_id": f.xp, "currency": "BRL",
	})

	args := f.petr4ToolArgs("2026-11-19", map[string]any{"kind": "buy"})
	got := fieldsOf(previewTool(t, f.h, "record_investment", args))

	if account, ok := got["account"]; ok {
		t.Fatalf("account = %q, want none", account)
	}
}

// TestRecordInvestmentPreviewSettlement: the exchange's cycle, the date given, and the trade date
// of a security without an exchange (IP2, IP4).
func TestRecordInvestmentPreviewSettlement(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	unlisted := security("FUNDX", "fund")
	delete(unlisted, "exchange")
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", unlisted, http.StatusCreated, nil)

	tests := []struct {
		name  string
		extra map[string]any
		want  string
	}{
		// 2026-11-20 is a B3 holiday: D+2 of Thursday 2026-11-19 is Tuesday 2026-11-24.
		{"cycle", nil, "2026-11-24"},
		{"given", map[string]any{"settlement_date": "2026-11-23"}, "2026-11-23"},
		{"no exchange", map[string]any{"instrument": "FUNDX"}, "2026-11-19"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			args := f.petr4ToolArgs("2026-11-19", map[string]any{"kind": "buy"})
			maps.Copy(args, tt.extra)
			expectFields(t, previewTool(t, f.h, "record_investment", args), map[string]string{
				"date": "2026-11-19", "settlement": tt.want,
			})
		})
	}
}

// TestRecordInvestmentSettlementDate records the date given, and refuses one out of range and one
// of a kind that takes none (IP4).
func TestRecordInvestmentSettlementDate(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	args := f.petr4ToolArgs("2026-11-19", map[string]any{
		"kind": "buy", "settlement_date": "2026-11-23",
	})

	var out investmentOut
	toolOutput(t, f.h, "record_investment", args, &out)

	var read tradeTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+out.TransactionID, nil, 200, &read)

	if read.Trade.SettlementDate != "2026-11-23" {
		t.Fatalf("settlement = %s, want 2026-11-23", read.Trade.SettlementDate)
	}

	args["settlement_date"] = "2026-11-18"
	f.h.ExpectToolError(
		f.h.Tool("record_investment", args), "validation_failed", "settlement_date",
	)

	f.h.ExpectToolError(
		f.h.Tool("record_investment", map[string]any{
			"kind": "write_off", "account_id": f.petr4, "date": "2026-11-19",
			"quantity": "1", "settlement_date": "2026-11-23",
		}),
		"invalid_arguments", "settlement_date",
	)
}

// TestRecordInvestmentPreviewIncome: the type and the net of the withheld tax (IP1, IP6).
func TestRecordInvestmentPreviewIncome(t *testing.T) {
	t.Parallel()
	f := newIncomeFixture(t)

	p := previewTool(t, f.h, "record_investment", map[string]any{
		"kind": "income", "account_id": f.mxrf11, "date": "2026-10-26", "gross": "184.20",
		"withheld": "27.63", "income_type": "jcp", "category_id": f.dividends,
	})

	expectFields(t, p, map[string]string{
		"income_type": "jcp", "amount": "184.20", "withheld": "27.63", "net": "156.57",
	})
}

// TestRecordInvestmentPreviewCorrection: the kind, and the value before of what changes only (IP8).
func TestRecordInvestmentPreviewCorrection(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	tx := f.buyPETR4(t, "2026-11-19", nil)

	p := previewTool(t, f.h, "record_investment", f.petr4ToolArgs("2026-11-19", map[string]any{
		"kind": "buy", "quantity": "120", "transaction_id": tx.ID, "reason": "120 units",
	}))

	expectFields(t, p, map[string]string{
		"kind":       "buy",
		"quantity":   "100 > 120",
		"price":      "30.00",
		"amount":     "3000.00 > 3600.00",
		"net":        "-3000.00 > -3600.00",
		"date":       "2026-11-19",
		"settlement": "2026-11-24",
	})
}

// TestRecordBrokerageNotePreview: one item per order, the net of the note and its settlement
// (IP1 to IP3).
func TestRecordBrokerageNotePreview(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	args := f.noteToolArgs(
		map[string]any{
			"side":       "buy",
			"instrument": "PETR4",
			"quantity":   "10",
			"unit_price": "38.2",
		},
		map[string]any{"side": "sell", "instrument": "MXRF11", "quantity": "5", "unit_price": "10"},
	)
	args["taxes"] = "0.09"

	p := previewTool(t, f.h, "record_brokerage_note", args)

	// 50.00 - 382.00 - 2.51 - 0.09.
	expectFields(t, p, map[string]string{
		"fees": "2.51", "taxes": "0.09", "net": "-334.60", "account": "XP cash",
		"date": "2026-11-10", "settlement": "2026-11-12",
	})

	if _, ok := fieldsOf(p)["count"]; ok || len(p.Items) != 2 {
		t.Fatalf("preview = %+v", p)
	}

	want := tool.Item{
		Description: "PETR4",
		Side:        "buy",
		Quantity:    tool.TextValue("10"),
		Price:       tool.TextValue("38.2"),
		Amount:      tool.Value{Amount: "382.00", Currency: "BRL"},
	}
	if p.Items[0] != want || p.Items[1].Side != "sell" {
		t.Fatalf("items = %+v", p.Items)
	}
}

// TestRecordBrokerageNotePreviewSettlements: orders that settle on two dates carry their own (IP2).
func TestRecordBrokerageNotePreviewSettlements(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	unlisted := security("FUNDX", "fund")
	delete(unlisted, "exchange")
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", unlisted, http.StatusCreated, nil)

	p := previewTool(t, f.h, "record_brokerage_note", f.noteToolArgs(
		map[string]any{"side": "buy", "instrument": "PETR4", "quantity": "1", "unit_price": "38"},
		map[string]any{"side": "buy", "instrument": "FUNDX", "quantity": "1", "unit_price": "10"},
	))

	if got, ok := fieldsOf(p)["settlement"]; ok {
		t.Fatalf("settlement = %q, want none", got)
	}

	if p.Items[0].Date != "2026-11-12" || p.Items[1].Date != "2026-11-10" {
		t.Fatalf("items = %+v", p.Items)
	}
}

// TestCorporateActionPreview: the code held, the security received and the money moved (IP1, IP9).
func TestCorporateActionPreview(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)

	tests := []struct {
		name  string
		extra map[string]any
		want  map[string]string
	}{
		{
			"split",
			map[string]any{"kind": "split", "ratio_from": 1, "ratio_to": 2},
			map[string]string{"ratio": "1 : 2", "instrument": "PETR4"},
		},
		{
			"conversion",
			map[string]any{
				"kind": "conversion", "ratio_from": 1, "ratio_to": 1, "new_instrument": "MXRF11",
			},
			map[string]string{"instrument": "PETR4 > MXRF11"},
		},
		{
			"capital return",
			map[string]any{"kind": "capital_return", "amount": "50.00"},
			map[string]string{"net": "50.00", "account": "XP cash", "instrument": "PETR4"},
		},
		{
			"right exercise",
			map[string]any{
				"kind": "right_exercise", "ratio_from": 1, "ratio_to": 1,
				"new_instrument": "MXRF11", "amount": "50.00",
			},
			map[string]string{"net": "-50.00", "account": "XP cash"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			args := map[string]any{"account_id": f.petr4, "date": "2026-11-10"}
			maps.Copy(args, tt.extra)
			expectFields(t, previewTool(t, f.h, "record_corporate_action", args), tt.want)
		})
	}
}

// TestCustodyPreview: the giving brokerage comes before the receiving one (IP9).
func TestCustodyPreview(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-03", nil)
	other := f.h.Account("Corretora B", "asset", "brokerage", nil)

	p := previewTool(t, f.h, "transfer_custody", map[string]any{
		"account_id": f.petr4, "brokerage_id": other, "date": "2026-11-10", "quantity": "40",
	})

	expectFields(t, p, map[string]string{"account": "XP > Corretora B", "instrument": "PETR4"})
}

func (f investFixture) petr4ToolArgs(date string, extra map[string]any) map[string]any {
	args := map[string]any{
		"brokerage_id": f.xp,
		"instrument":   "PETR4",
		"date":         date,
		"quantity":     "100",
		"unit_price":   "30.00",
	}
	maps.Copy(args, extra)

	return args
}

func expectFields(t *testing.T, p tool.Preview, want map[string]string) {
	t.Helper()

	got := fieldsOf(p)
	for field, value := range want {
		if got[field] != value {
			t.Errorf("%s = %q, want %q", field, got[field], value)
		}
	}
}

// fieldsOf writes each change as its value after, or "before > after".
func fieldsOf(p tool.Preview) map[string]string {
	out := map[string]string{}

	for _, c := range p.Changes {
		text := valueOf(c.After)
		if c.Before != (tool.Value{}) {
			text = valueOf(c.Before) + " > " + text
		}

		out[c.Field] = text
	}

	return out
}

func valueOf(v tool.Value) string { return v.Text + v.Amount + v.Date }
