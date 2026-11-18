package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// loadGoalExpense reads the goal and the transaction of a link (planning coherence A256).
func loadGoalExpense(
	ctx context.Context,
	svc *app.Service,
	l Ledger,
	booksID int64,
	p *budgetGoalPlan,
) error {
	var err error
	if p.goal, err = svc.Goal(ctx, booksID, p.goalID); err != nil {
		return err
	}

	tx, ok, err := l.Transaction(ctx, booksID, p.txID)
	if err == nil && !ok {
		return validationError("transaction_id", "must be a transaction of the book, not voided")
	}

	p.tx = tx

	return err
}

// runGoalExpense links the transaction to the goal or removes that link.
func runGoalExpense(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageBudgetOrGoalIn,
	p budgetGoalPlan,
) (manageBudgetOrGoalOut, error) {
	out := manageBudgetOrGoalOut{GoalID: p.goalID.String()}
	if in.Action == "unlink_expense" {
		return out, svc.UnlinkGoalExpense(ctx, booksID, p.goalID, p.txID)
	}

	return out, svc.LinkGoalExpense(ctx, booksID, p.goalID, p.txID)
}

// previewGoalExpense shows the transaction a goal starts or stops paying.
func previewGoalExpense(pv *tool.Preview, in manageBudgetOrGoalIn, p budgetGoalPlan) {
	text, date := tool.TextValue(p.tx.Description), tool.DateValue(p.tx.Date)
	pv.Target = p.goal.Name

	if in.Action == "unlink_expense" {
		pv.Changes = []tool.Change{
			{Field: "transaction", Before: text},
			{Field: "date", Before: date},
		}

		return
	}

	pv.Changes = []tool.Change{{Field: "transaction", After: text}, {Field: "date", After: date}}
}
