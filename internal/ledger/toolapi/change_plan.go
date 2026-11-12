package toolapi

import (
	"context"
	"strings"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func planChange(ctx context.Context, svc *app.Service, booksID int64, in changeTransactionIn) (changePlan, error) {
	var p changePlan

	id, err := requiredID(in.TransactionID, "transaction_id")
	if err != nil {
		return p, err
	}

	if p.current, err = svc.Transaction(ctx, booksID, id); err != nil {
		return p, err
	}

	given := map[string]bool{
		"reason": in.Reason != "", "date": !in.Date.IsZero(), "description": in.Description != "",
		"payee_id": in.PayeeID != "", "tags": in.Tags != nil, "amount": in.Amount != "",
		"from_account_id": in.FromAccountID != "", "to_account_id": in.ToAccountID != "",
		"allocations": len(in.Allocations) > 0,
	}
	switch in.Action {
	case "correct":
		return planCorrect(ctx, svc, booksID, in, given, p)
	case "make_transfer":
		return planMakeTransfer(ctx, svc, booksID, in, given, p)
	default:
		return planReimburse(ctx, svc, booksID, in, given, p)
	}
}

func planCorrect(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in changeTransactionIn,
	given map[string]bool,
	p changePlan,
) (changePlan, error) {
	used := []string{
		"reason", "date", "description", "payee_id", "tags", "amount", "from_account_id", "to_account_id",
	}
	if err := unusedFields("correct", given, used...); err != nil {
		return p, err
	}

	if in.Reason == "" {
		return p, tool.InvalidArgument("reason", "is required for correct")
	}

	if err := installmentFields(p.current, given); err != nil {
		return p, err
	}

	var err error

	p.next, err = correctedTransaction(ctx, svc, booksID, p.current, in)

	return p, err
}

func planMakeTransfer(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in changeTransactionIn,
	given map[string]bool,
	p changePlan,
) (changePlan, error) {
	if err := unusedFields("make_transfer", given, "to_account_id"); err != nil {
		return p, err
	}

	to, err := requiredID(in.ToAccountID, "to_account_id")
	if err != nil {
		return p, err
	}

	p.transfer, err = svc.Account(ctx, booksID, to)

	return p, err
}

func planReimburse(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in changeTransactionIn,
	given map[string]bool,
	p changePlan,
) (changePlan, error) {
	if err := unusedFields("reimburse", given, "allocations"); err != nil {
		return p, err
	}

	if len(in.Allocations) == 0 {
		return p, tool.InvalidArgument("allocations", "is required for reimburse")
	}

	var unit money.Money
	for _, po := range p.current.Postings {
		unit = po.Amount
		break
	}

	for _, a := range in.Allocations {
		expenseID, err := requiredID(a.ExpenseID, "allocations")
		if err != nil {
			return p, err
		}

		expense, err := svc.Transaction(ctx, booksID, expenseID)
		if err != nil {
			return p, err
		}

		amount, err := tool.ParsePositive("allocations", a.Amount, unit)
		if err != nil {
			return p, err
		}

		p.allocs = append(p.allocs, app.AllocationRequest{OriginalID: expenseID, Amount: amount})
		p.expenses = append(p.expenses, expense)
	}

	return p, nil
}

// installmentFields rejects the correct arguments an installment purchase does not take.
func installmentFields(cur domain.Transaction, given map[string]bool) error {
	if !cur.HasInstallments() {
		return nil
	}

	var blocked []string
	for _, f := range []string{"date", "amount", "from_account_id", "to_account_id"} {
		if given[f] {
			blocked = append(blocked, f)
		}
	}

	if len(blocked) == 0 {
		return nil
	}

	return tool.InvalidArgument(blocked[0], strings.Join(blocked, ", ")+
		" of an installment purchase change through refunds, cancellation or anticipation: handle_card_purchase does")
}

// sides returns the indexes of the source and the destination of a two-posting transaction.
func sides(t domain.Transaction) (from, to int, ok bool) {
	if len(t.Postings) != 2 {
		return 0, 0, false
	}

	if t.Postings[0].Amount.IsNegative() {
		return 0, 1, true
	}

	return 1, 0, true
}
