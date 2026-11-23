package ledger_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

type settleOut struct {
	StatementID   string `json:"statement_id"`
	TransactionID string `json:"transaction_id"`
}

// TestSettleStatementPayS10 follows the full payment of S10.
func TestSettleStatementPayS10(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)
	sid := c.statementID(t, "2026-11")
	args := map[string]any{
		"statement_id":    sid,
		"action":          "pay",
		"date":            "2026-11-10",
		"amount":          "1500.00",
		"from_account_id": c.checking,
	}

	p := previewTool(t, c.h, "settle_statement", args)
	if p.Action != "settle_statement.pay" {
		t.Fatalf("action = %q", p.Action)
	}

	if p.Target != "Itaú Visa" || p.Basis != "1500.00:1500.00" ||
		p.Changes[0].Field != "statement" || p.Changes[0].After.Text != "2026-11" ||
		p.Changes[1].After.Amount != "1500.00" ||
		p.Changes[2].After.Text != "Nubank" {
		t.Fatalf("preview = %+v", p)
	}

	if s := statements(t, c.h, c.card)["2026-11"]; s.Status == "paid" {
		t.Fatalf("status after preview = %s", s.Status)
	}

	var out settleOut
	toolOutput(t, c.h, "settle_statement", args, &out)

	if card := cardPostings(c.h.Transaction(out.TransactionID), c.card)[0]; card.CardRole != "payment" ||
		card.Statement != "2026-12" ||
		card.Amount.Amount != 150000 {
		t.Fatalf("payment posting = %+v", card)
	}

	if s := statements(t, c.h, c.card)["2026-11"]; s.Status != "paid" {
		t.Fatalf("status = %s", s.Status)
	}
}

// TestSettleStatementFinanceS11 follows the financing of S11: 2,000.00 in 6 of 363.40.
func TestSettleStatementFinanceS11(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 200000)
	args := map[string]any{
		"statement_id":       c.statementID(t, "2026-11"),
		"action":             "finance",
		"date":               "2026-11-12",
		"installment_count":  6,
		"installment_amount": "363.40",
	}

	p := previewTool(t, c.h, "settle_statement", args)
	if p.Changes[0].Field != "statement" || p.Changes[1].Field != "installments" ||
		p.Changes[1].After.Text != "6" || p.Changes[2].After.Amount != "363.40" {
		t.Fatalf("preview = %+v", p)
	}

	var out settleOut
	toolOutput(t, c.h, "settle_statement", args, &out)

	if s := statements(t, c.h, c.card)["2026-11"]; s.Status != "financed" {
		t.Fatalf("status = %s", s.Status)
	}
}

func TestSettleStatementFacts(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)
	sid := c.statementID(t, "2026-11")
	var out settleOut

	facts := map[string]any{
		"statement_id": sid,
		"action":       "set_facts",
		"amount":       "1500.00",
		"due_date":     "2026-11-10",
		"closing_date": "2026-11-03",
	}
	if p := previewTool(
		t,
		c.h,
		"settle_statement",
		facts,
	); p.Changes[2].Field != "due_on" ||
		p.Changes[2].After.Date != "2026-11-10" {
		t.Fatalf("preview = %+v", p)
	}

	toolOutput(t, c.h, "settle_statement", facts, &out)
	toolOutput(
		t,
		c.h,
		"settle_statement",
		map[string]any{"statement_id": sid, "action": "remove_facts"},
		&out,
	)
	toolOutput(
		t,
		c.h,
		"settle_statement",
		map[string]any{"statement_id": sid, "action": "confirm_amount_due", "amount": "1500.00"},
		&out,
	)

	if s := statements(t, c.h, c.card)["2026-11"]; !s.Reconciled {
		t.Errorf("statement not reconciled: %+v", s)
	}
}

func TestSettleStatementInvalidArguments(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)
	sid := c.statementID(t, "2026-11")
	c.h.ExpectToolError(
		c.h.Tool(
			"settle_statement",
			map[string]any{"statement_id": sid, "action": "pay", "amount": "1.00"},
		),
		"invalid_arguments",
		"from_account_id",
	)
	c.h.ExpectToolError(
		c.h.Tool(
			"settle_statement",
			map[string]any{"statement_id": sid, "action": "remove_facts", "amount": "1.00"},
		),
		"invalid_arguments",
		"amount",
	)
}

func TestSettleStatementOtherUser(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")

	_, _, foreign := otherUserCardPurchase(t, c.h)
	for _, args := range []map[string]any{
		{"statement_id": foreign, "action": "pay", "amount": "1.00", "from_account_id": c.checking},
		{"statement_id": foreign, "action": "finance", "installment_count": 2, "installment_amount": "1.00"},
		{"statement_id": foreign, "action": "confirm_amount_due", "amount": "1.00"},
		{"statement_id": foreign, "action": "set_facts", "amount": "1.00", "due_date": "2026-11-10"},
		{"statement_id": foreign, "action": "remove_facts"},
	} {
		c.h.ExpectToolError(c.h.Tool("settle_statement", args), "not_found", "")
	}
}

func TestSettleStatementFactsMinimum(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)
	sid := c.statementID(t, "2026-11")

	facts := map[string]any{
		"statement_id": sid,
		"action":       "set_facts",
		"amount":       "1500.00",
		"minimum":      "225.00",
		"due_date":     "2026-11-10",
	}

	p := previewTool(t, c.h, "settle_statement", facts)
	if len(p.Changes) != 4 || p.Changes[3].Field != "limit" ||
		p.Changes[3].After.Amount != "225.00" {
		t.Fatalf("preview = %+v", p)
	}

	toolOutput(t, c.h, "settle_statement", facts, &settleOut{})

	var raw json.RawMessage
	c.h.MustDo(http.MethodGet, "/api/v1/statements/"+sid, nil, http.StatusOK, &raw)

	if !strings.Contains(string(raw), `"minimum":{"amount":22500`) {
		t.Errorf("statement = %s", raw)
	}

	c.h.ExpectToolError(
		c.h.Tool(
			"settle_statement",
			map[string]any{
				"statement_id":    sid,
				"action":          "pay",
				"amount":          "1.00",
				"from_account_id": c.checking,
				"minimum":         "1.00",
			},
		),
		"invalid_arguments",
		"minimum",
	)
	c.h.ExpectToolError(
		c.h.Tool(
			"settle_statement",
			map[string]any{
				"statement_id": sid,
				"action":       "set_facts",
				"amount":       "1500.00",
				"due_date":     "2026-11-10",
				"minimum":      "x",
			},
		),
		"invalid_arguments",
		"minimum",
	)
}
