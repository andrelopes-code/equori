package toolapi

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type changeTransactionAction string

func (changeTransactionAction) Values() []string {
	return []string{"correct", "make_transfer", "reimburse"}
}

type changeTransactionAllocationsItem struct {
	ExpenseID string `json:"expense_id" jsonschema:"transaction_id of the expense repaid"`
	Amount    string `json:"amount" jsonschema:"positive decimal amount allocated to it"`
}

type changeTransactionIn struct {
	TransactionID string                             `json:"transaction_id" jsonschema:"ID of the transaction, from search_transactions"`
	Action        changeTransactionAction            `json:"action" jsonschema:"correct changes the fields given, and on an installment purchase only description, payee_id and tags; make_transfer replaces the category side with another own account; reimburse links this incoming transaction to the expenses it repays"`
	Reason        string                             `json:"reason,omitzero" jsonschema:"for correct: why the transaction changes, kept in its history"`
	Date          tool.Date                          `json:"date,omitzero" jsonschema:"for correct: new date"`
	Description   string                             `json:"description,omitzero" jsonschema:"for correct: new description"`
	PayeeID       string                             `json:"payee_id,omitzero" jsonschema:"for correct: new payee from list_payees_and_tags"`
	Tags          []string                           `json:"tags,omitzero" jsonschema:"for correct: the complete new list of tags"`
	Amount        string                             `json:"amount,omitzero" jsonschema:"for correct: new positive amount of a transaction with one source and one destination"`
	FromAccountID string                             `json:"from_account_id,omitzero" jsonschema:"for correct: new source account or category"`
	ToAccountID   string                             `json:"to_account_id,omitzero" jsonschema:"for correct: new destination account or category; for make_transfer: the own account that receives the money"`
	Allocations   []changeTransactionAllocationsItem `json:"allocations,omitzero" jsonschema:"for reimburse: the expenses repaid and the part of this transaction each takes"`
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
	}, func(ctx context.Context, userID int64, in changeTransactionIn) (tool.Preview, error) {
		p, err := planChange(ctx, svc, userID, in)
		if err != nil {
			return tool.Preview{}, err
		}
		pv := tool.Preview{Action: "change_transaction", Target: targetOf(p.current), Basis: basisOf(p.current)}
		accounts, _, err := allAccounts(ctx, svc, userID)
		if err != nil {
			return pv, err
		}
		switch in.Action {
		case "correct":
			pv.Changes, err = correctionChanges(ctx, svc, userID, p, accounts)
		case "make_transfer":
			before := ""
			for _, po := range p.current.Postings {
				if a := accounts[po.AccountID]; a.IsCategory() {
					before = a.Name
				}
			}
			pv.Changes = []tool.Change{{Field: "account", Before: tool.TextValue(before), After: tool.TextValue(p.transfer.Name)}}
		default:
			var total money.Money
			for i, a := range p.allocs {
				pv.Changes = append(pv.Changes, tool.Change{Field: "transaction", After: tool.TextValue(targetText(p.expenses[i]))})
				if i == 0 {
					total = a.Amount
				} else if total, err = total.Add(a.Amount); err != nil {
					return pv, err
				}
			}
			pv.Changes = append(pv.Changes, tool.Change{Field: "amount", After: tool.MoneyValue(total)})
		}
		return pv, err
	}, func(ctx context.Context, userID int64, in changeTransactionIn) (changeTransactionOut, error) {
		p, err := planChange(ctx, svc, userID, in)
		if err != nil {
			return changeTransactionOut{}, err
		}
		var id uuid.UUID
		switch in.Action {
		case "correct":
			var t domain.Transaction
			if t, err = svc.CorrectTransaction(ctx, userID, p.current.ID, p.current.Version, p.next, in.Reason); err == nil {
				id = t.ID
			}
		case "make_transfer":
			var res app.TransferResult
			res, err = svc.Transfer(ctx, userID, app.TransferRequest{
				TransactionID: p.current.ID, ExpectedVersion: p.current.Version, AccountID: p.transfer.ID, Cause: app.Cause{Method: app.MethodManual},
			})
			id = res.Kept
		default:
			var t domain.Transaction
			if t, err = svc.Reimburse(ctx, userID, app.ReimbursementRequest{
				TransactionID: p.current.ID, ExpectedVersion: p.current.Version, Allocations: p.allocs, Cause: app.Cause{Method: app.MethodManual},
			}); err == nil {
				id = t.ID
			}
		}
		if err != nil {
			return changeTransactionOut{}, err
		}
		t, err := svc.Transaction(ctx, userID, id)
		return changeTransactionOut{TransactionID: id.String(), Version: t.Version}, err
	})
}

func targetText(t domain.Transaction) string {
	return t.Description + " of " + t.Date.Format("2006-01-02")
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

func planChange(ctx context.Context, svc *app.Service, userID int64, in changeTransactionIn) (changePlan, error) {
	var p changePlan
	id, err := requiredID(in.TransactionID, "transaction_id")
	if err != nil {
		return p, err
	}
	if p.current, err = svc.Transaction(ctx, userID, id); err != nil {
		return p, err
	}
	given := map[string]bool{
		"reason": in.Reason != "", "date": !in.Date.IsZero(), "description": in.Description != "", "payee_id": in.PayeeID != "",
		"tags": in.Tags != nil, "amount": in.Amount != "", "from_account_id": in.FromAccountID != "",
		"to_account_id": in.ToAccountID != "", "allocations": len(in.Allocations) > 0,
	}
	switch in.Action {
	case "correct":
		if err := unusedFields("correct", given, "reason", "date", "description", "payee_id", "tags", "amount", "from_account_id", "to_account_id"); err != nil {
			return p, err
		}
		if in.Reason == "" {
			return p, tool.InvalidArgument("reason", "is required for correct")
		}
		if err := installmentFields(p.current, given); err != nil {
			return p, err
		}
		p.next, err = correctedTransaction(ctx, svc, userID, p.current, in)
	case "make_transfer":
		if err := unusedFields("make_transfer", given, "to_account_id"); err != nil {
			return p, err
		}
		var to uuid.UUID
		if to, err = requiredID(in.ToAccountID, "to_account_id"); err != nil {
			return p, err
		}
		p.transfer, err = svc.Account(ctx, userID, to)
	default:
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
			var expenseID uuid.UUID
			if expenseID, err = requiredID(a.ExpenseID, "allocations"); err != nil {
				return p, err
			}
			expense, err := svc.Transaction(ctx, userID, expenseID)
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
	}
	return p, err
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

func correctedTransaction(ctx context.Context, svc *app.Service, userID int64, cur domain.Transaction, in changeTransactionIn) (domain.Transaction, error) {
	next := domain.Transaction{
		Date: cur.Date, Description: cur.Description, PayeeID: cur.PayeeID, Tags: cur.Tags, Links: cur.Links,
		Origin: cur.Origin,
	}
	for _, po := range cur.Postings {
		next.Postings = append(next.Postings, domain.Posting{AccountID: po.AccountID, Amount: po.Amount, Weight: po.Weight, Memo: po.Memo})
	}
	if !in.Date.IsZero() {
		next.Date = in.Date.Time
	}
	if in.Description != "" {
		next.Description = in.Description
	}
	if in.PayeeID != "" {
		id, err := optionalID(in.PayeeID, "payee_id")
		if err != nil {
			return next, err
		}
		next.PayeeID = id
	}
	if in.Tags != nil {
		next.Tags = in.Tags
	}
	from, to, two := sides(cur)
	for field, given := range map[string]bool{"amount": in.Amount != "", "from_account_id": in.FromAccountID != "", "to_account_id": in.ToAccountID != ""} {
		if given && !two {
			return next, tool.InvalidArgument(field, "applies only to a transaction with one source and one destination")
		}
	}
	if in.Amount != "" {
		amount, err := tool.ParsePositive("amount", in.Amount, cur.Postings[from].Amount)
		if err != nil {
			return next, err
		}
		next.Postings[from].Amount, next.Postings[to].Amount = amount.Neg(), amount
		next.Postings[from].Weight, next.Postings[to].Weight = money.Money{}, money.Money{}
	}
	for idx, s := range map[int]string{from: in.FromAccountID, to: in.ToAccountID} {
		if s == "" {
			continue
		}
		field := "from_account_id"
		if idx == to {
			field = "to_account_id"
		}
		id, err := requiredID(s, field)
		if err != nil {
			return next, err
		}
		a, err := svc.Account(ctx, userID, id)
		if err != nil {
			return next, err
		}
		next.Postings[idx].AccountID = a.ID
	}
	return next, nil
}

func correctionChanges(ctx context.Context, svc *app.Service, userID int64, p changePlan, accounts map[uuid.UUID]domain.Account) ([]tool.Change, error) {
	cur, next := p.current, p.next
	var out []tool.Change
	if !cur.Date.Equal(next.Date) {
		out = append(out, tool.Change{Field: "date", Before: tool.DateValue(cur.Date), After: tool.DateValue(next.Date)})
	}
	if cur.Description != next.Description {
		out = append(out, tool.Change{Field: "description", Before: tool.TextValue(cur.Description), After: tool.TextValue(next.Description)})
	}
	if cur.PayeeID != next.PayeeID {
		names, err := svc.PayeeNames(ctx, userID, []uuid.UUID{cur.PayeeID, next.PayeeID})
		if err != nil {
			return nil, err
		}
		out = append(out, tool.Change{Field: "payee", Before: tool.TextValue(names[cur.PayeeID]), After: tool.TextValue(names[next.PayeeID])})
	}
	if a, b := strings.Join(cur.Tags, ", "), strings.Join(next.Tags, ", "); a != b {
		out = append(out, tool.Change{Field: "tags", Before: tool.TextValue(a), After: tool.TextValue(b)})
	}
	if from, to, ok := sides(cur); ok {
		if a, b := cur.Postings[to].Amount, next.Postings[to].Amount; a != b {
			out = append(out, tool.Change{Field: "amount", Before: tool.MoneyValue(a), After: tool.MoneyValue(b)})
		}
		for _, i := range []int{from, to} {
			a, b := accounts[cur.Postings[i].AccountID], accounts[next.Postings[i].AccountID]
			if a.ID == b.ID {
				continue
			}
			field := "account"
			if b.IsCategory() {
				field = "category"
			}
			out = append(out, tool.Change{Field: field, Before: tool.TextValue(a.Name), After: tool.TextValue(b.Name)})
		}
	}
	return out, nil
}
