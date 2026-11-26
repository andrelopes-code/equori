package toolapi

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type changeTransactionAction string

func (changeTransactionAction) Values() []string {
	return []string{"correct", "make_transfer", "reimburse"}
}

type changeTransactionAllocationsItem struct {
	ExpenseID string `json:"expense_id" jsonschema:"transaction_id of the expense repaid"`
	Amount    string `json:"amount"     jsonschema:"positive decimal amount allocated to it"`
}

type changeTransactionIn struct {
	TransactionID string                             `json:"transaction_id"           jsonschema:"ID of the transaction, from search_transactions"`
	Action        changeTransactionAction            `json:"action"                   jsonschema:"correct changes the fields given, and on an installment purchase only description, payee_id and tags; make_transfer replaces the category side with another own account; reimburse links this incoming transaction to the expenses it repays"`
	Reason        string                             `json:"reason,omitzero"          jsonschema:"for correct: why the transaction changes, kept in its history"`
	Date          tool.Date                          `json:"date,omitzero"            jsonschema:"for correct: new date"`
	Description   string                             `json:"description,omitzero"     jsonschema:"for correct: new description"`
	PayeeID       string                             `json:"payee_id,omitzero"        jsonschema:"for correct: new payee from list_payees_and_tags"`
	Tags          []string                           `json:"tags,omitzero"            jsonschema:"for correct: the complete new list of tags"`
	Amount        string                             `json:"amount,omitzero"          jsonschema:"for correct: new positive amount of a transaction with one source and one destination"`
	FromAccountID string                             `json:"from_account_id,omitzero" jsonschema:"for correct: new source account or category"`
	ToAccountID   string                             `json:"to_account_id,omitzero"   jsonschema:"for correct: new destination account or category; for make_transfer: the own account that receives the money"`
	Allocations   []changeTransactionAllocationsItem `json:"allocations,omitzero"     jsonschema:"for reimburse: the expenses repaid and the part of this transaction each takes"`
}

type changeTransactionOut struct {
	TransactionID string `json:"transaction_id"`
	Version       int    `json:"version"`
}

// changePlan is a change_transaction request resolved against the current transaction.
type changePlan struct {
	current  domain.Transaction
	next     domain.Transaction // correct
	transfer domain.Account     // make_transfer
	allocs   []app.AllocationRequest
	expenses []domain.Transaction
}

func changeTransaction(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "change_transaction",
		Description: "Proposes a change to an existing transaction: correct its date, description, payee, tags, amount or accounts, and on an installment purchase only its description, payee or tags; " +
			"turn its category side into a transfer to another own account; or make this incoming transaction the reimbursement of recorded expenses. " +
			"Use it when the user asks to fix, edit or relink a transaction. " +
			"Do not use it to set a category: categorize_transactions does; nor to void: void_transaction does; nor for card refunds: handle_card_purchase does. " +
			"The user confirms before the change applies.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in changeTransactionIn) (tool.Preview, error) {
		return previewChange(ctx, svc, booksID, in)
	}, func(ctx context.Context, booksID int64, in changeTransactionIn) (changeTransactionOut, error) {
		return runChange(ctx, svc, booksID, in)
	})
}

func previewChange(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in changeTransactionIn,
) (tool.Preview, error) {
	p, err := planChange(ctx, svc, booksID, in)
	if err != nil {
		return tool.Preview{}, err
	}

	pv := tool.Preview{
		Action: "change_transaction." + string(in.Action),
		Target: p.current.Description,
		Basis:  basisOf(p.current),
	}

	accounts, _, err := allAccounts(ctx, svc, booksID)
	if err != nil {
		return pv, err
	}

	pv.Items = []tool.Item{itemOf(p.current, accounts)}

	switch in.Action {
	case "correct":
		pv.Changes, err = correctionChanges(ctx, svc, booksID, p, accounts)
	case "make_transfer":
		pv.Changes = transferChanges(p, accounts)
	default:
		pv.Changes, err = reimbursementChanges(p)
	}

	return pv, err
}

func transferChanges(p changePlan, accounts map[uuid.UUID]domain.Account) []tool.Change {
	before := ""
	for _, po := range p.current.Postings {
		if a := accounts[po.AccountID]; a.IsCategory() {
			before = a.Name
		}
	}

	return []tool.Change{
		{Field: "account", Before: tool.TextValue(before), After: tool.TextValue(p.transfer.Name)},
	}
}

func reimbursementChanges(p changePlan) ([]tool.Change, error) {
	var changes []tool.Change

	var total money.Money
	for i, a := range p.allocs {
		changes = append(
			changes,
			tool.Change{Field: "reimbursed", After: tool.TextValue(p.expenses[i].Description)},
		)
		if i == 0 {
			total = a.Amount
		} else if sum, err := total.Add(a.Amount); err != nil {
			return changes, err
		} else {
			total = sum
		}
	}

	return append(changes, tool.Change{Field: "amount", After: tool.MoneyValue(total)}), nil
}

func runChange(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in changeTransactionIn,
) (changeTransactionOut, error) {
	p, err := planChange(ctx, svc, booksID, in)
	if err != nil {
		return changeTransactionOut{}, err
	}

	id, err := applyChange(ctx, svc, booksID, in, p)
	if err != nil {
		return changeTransactionOut{}, err
	}

	t, err := svc.Transaction(ctx, booksID, id)

	return changeTransactionOut{TransactionID: id.String(), Version: t.Version}, err
}

func applyChange(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in changeTransactionIn,
	p changePlan,
) (uuid.UUID, error) {
	var id uuid.UUID

	var err error
	switch in.Action {
	case "correct":
		var t domain.Transaction
		if t, err = svc.CorrectTransaction(
			ctx,
			booksID,
			p.current.ID,
			p.current.Version,
			p.next,
			in.Reason,
		); err == nil {
			id = t.ID
		}
	case "make_transfer":
		var res app.TransferResult
		res, err = svc.Transfer(ctx, booksID, app.TransferRequest{
			TransactionID:   p.current.ID,
			ExpectedVersion: p.current.Version,
			AccountID:       p.transfer.ID,
			Cause:           app.Cause{Method: app.MethodManual},
		})
		id = res.Kept
	default:
		var t domain.Transaction
		if t, err = svc.Reimburse(ctx, booksID, app.ReimbursementRequest{
			TransactionID: p.current.ID, ExpectedVersion: p.current.Version, Allocations: p.allocs,
			Cause: app.Cause{Method: app.MethodManual},
		}); err == nil {
			id = t.ID
		}
	}

	return id, err
}

// unusedFields rejects the arguments the action does not read.
func unusedFields(action string, given map[string]bool, used ...string) error {
	for f, ok := range given {
		if ok && !slices.Contains(used, f) {
			return tool.InvalidArgument(f, "is not used by "+action)
		}
	}

	return nil
}
