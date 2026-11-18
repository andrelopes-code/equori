package ingestion_test

import (
	"testing"
)

type toolMovement struct {
	MovementID    string `json:"movement_id"`
	Kind          string `json:"kind"`
	Date          string `json:"date"`
	State         string `json:"state"`
	Proposal      string `json:"proposal"`
	TransactionID string `json:"transaction_id"`
	Amount        struct {
		Amount string `json:"amount"`
	} `json:"amount"`
}

// TestReviewInvestmentMovementToolS545 lists the application of S545 with get_imports and
// confirms it through the tool: one purchase of 1000.00 in the ledger.
func TestReviewInvestmentMovementToolS545(t *testing.T) {
	t.Parallel()
	f := newReviewFixture(t)
	f.serve("1000.00", "2026-01-10", pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"))

	var listed struct {
		Investments []struct {
			Name      string         `json:"name"`
			Subtype   string         `json:"subtype"`
			Movements []toolMovement `json:"movements"`
		} `json:"investments"`
	}
	toolOutput(t, f.h, "get_imports", map[string]any{
		"view": "investments", "connection_id": f.conn.ID,
	}, &listed)

	if len(listed.Investments) != 1 || len(listed.Investments[0].Movements) != 1 {
		t.Fatalf("investments = %+v", listed.Investments)
	}

	buy := listed.Investments[0].Movements[0]
	if buy.Kind != "buy" || buy.Date != "2026-01-10" || buy.Amount.Amount != "1000.00" ||
		buy.State != "pending" || buy.Proposal != "application" {
		t.Fatalf("movement = %+v", buy)
	}

	args := map[string]any{
		"action": "confirm", "movement_id": buy.MovementID,
		"brokerage_id": f.brokerage, "cash_account_id": f.cash,
	}

	p, r := preview(t, f.h, "review_investment_movement", args)
	if r.IsError || p.Action != "review_investment_movement.confirm" ||
		p.Target != listed.Investments[0].Name || p.Changes[0].After.Amount != "1000.00" {
		t.Fatalf("preview = %+v %s", p, r.Content)
	}

	var got toolMovement
	toolOutput(t, f.h, "review_investment_movement", args, &got)

	if got.State != "confirmed" || got.TransactionID == "" {
		t.Fatalf("confirmed = %+v", got)
	}

	rows := f.h.Rows(`SELECT quantity, unit_price::text, gross FROM ledger_trade`)
	if len(rows) != 1 || rows[0] != "1000000000 1.000000000000 100000" {
		t.Fatalf("trades = %v", rows)
	}

	f.h.ExpectToolError(
		f.h.Tool("review_investment_movement", args),
		"investment_movement_resolved",
		"",
	)
}

// TestReviewInvestmentMovementToolS548 dismisses an income, reopens it and refuses the undo of
// a purchase with a later confirmed movement.
func TestReviewInvestmentMovementToolS548(t *testing.T) {
	t.Parallel()
	f := newReviewFixture(t)
	inv := f.serve(
		"1000.00", "2026-02-10",
		pluggyMove("m-buy", "BUY", "2026-01-10", "1000.00"),
		pluggyMove("m-income", "INTEREST", "2026-02-10", "12.34"),
	)
	buy := inv.movement(t, "buy", "2026-01-10")
	income := inv.movement(t, "income", "2026-02-10")
	act := func(action, movement string, extra map[string]any) map[string]any {
		args := map[string]any{"action": action, "movement_id": movement}
		for k, v := range extra {
			args[k] = v
		}

		return args
	}

	var got toolMovement
	toolOutput(t, f.h, "review_investment_movement", act("dismiss", income.ID, nil), &got)

	if got.State != "dismissed" {
		t.Fatalf("dismissed = %+v", got)
	}

	toolOutput(t, f.h, "review_investment_movement", act("undo", income.ID, nil), &got)

	if got.State != "pending" {
		t.Fatalf("undone = %+v", got)
	}

	f.h.ExpectToolError(
		f.h.Tool("review_investment_movement", act("confirm", buy.ID, nil)),
		"validation_failed",
		"brokerage_id",
	)
	f.h.ExpectToolError(
		f.h.Tool("review_investment_movement", act("dismiss", income.ID, f.applyBody())),
		"invalid_arguments",
		"brokerage_id",
	)

	toolOutput(t, f.h, "review_investment_movement", act("confirm", buy.ID, f.applyBody()), &got)
	toolOutput(
		t,
		f.h,
		"review_investment_movement",
		act("confirm", income.ID, f.incomeBody()),
		&got,
	)

	f.h.ExpectToolError(
		f.h.Tool("review_investment_movement", act("undo", buy.ID, nil)),
		"later_movement_confirmed",
		"",
	)
}
