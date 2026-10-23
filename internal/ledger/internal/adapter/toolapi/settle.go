package toolapi

import (
	"context"
	"strconv"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type settleStatementAction string

func (settleStatementAction) Values() []string {
	return []string{"pay", "finance", "confirm_amount_due", "set_facts", "remove_facts"}
}

type settleStatementIn struct {
	StatementID       string                `json:"statement_id" jsonschema:"statement from get_account_details"`
	Action            settleStatementAction `json:"action" jsonschema:"operation to propose"`
	Date              tool.Date             `json:"date,omitzero" jsonschema:"for pay and finance: date of the operation; today when absent"`
	Amount            string                `json:"amount,omitzero" jsonschema:"for pay: amount paid; for confirm_amount_due and set_facts: the institution's total; positive, in the card's currency"`
	FromAccountID     string                `json:"from_account_id,omitzero" jsonschema:"for pay: account the payment leaves"`
	InstallmentCount  int                   `json:"installment_count,omitzero" jsonschema:"for finance: number of installments"`
	InstallmentAmount string                `json:"installment_amount,omitzero" jsonschema:"for finance: positive amount of each installment"`
	DueDate           tool.Date             `json:"due_date,omitzero" jsonschema:"for set_facts: due date the institution states"`
	ClosingDate       tool.Date             `json:"closing_date,omitzero" jsonschema:"for set_facts: closing date the institution states"`
}

type settleStatementOut struct {
	StatementID   string `json:"statement_id"`
	TransactionID string `json:"transaction_id,omitzero"`
}

func settleStatement(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "settle_statement",
		Description: "Proposes an action on a credit card statement: pay it from an account, finance its unpaid amount in installments, confirm the amount the institution charges, or record or remove the institution's due date and total. " +
			"Use it when the user pays a card bill or reports what the bank's statement says. " +
			"Do not use it for one purchase: handle_card_purchase does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, userID int64, in settleStatementIn) (tool.Preview, error) {
		pv, _, err := planSettle(ctx, svc, userID, in)
		return pv, err
	}, func(ctx context.Context, userID int64, in settleStatementIn) (settleStatementOut, error) {
		_, run, err := planSettle(ctx, svc, userID, in)
		if err != nil {
			return settleStatementOut{}, err
		}
		return run()
	})
}

func planSettle(ctx context.Context, svc *app.Service, userID int64, in settleStatementIn) (tool.Preview, func() (settleStatementOut, error), error) {
	action := string(in.Action)
	pv := tool.Preview{Action: "settle_statement"}
	id, err := requiredID(in.StatementID, "statement_id")
	if err != nil {
		return pv, nil, err
	}
	fromID, err := optionalID(in.FromAccountID, "from_account_id")
	if err != nil {
		return pv, nil, err
	}
	given := map[string]bool{
		"statement_id": true, "date": !in.Date.IsZero(), "amount": in.Amount != "", "from_account_id": in.FromAccountID != "",
		"installment_count": in.InstallmentCount != 0, "installment_amount": in.InstallmentAmount != "", "due_date": !in.DueDate.IsZero(), "closing_date": !in.ClosingDate.IsZero(),
	}
	required := []string{"statement_id"}
	var optional []string
	switch in.Action {
	case "pay":
		required, optional = append(required, "amount", "from_account_id"), []string{"date"}
	case "finance":
		required, optional = append(required, "installment_count", "installment_amount"), []string{"date"}
	case "confirm_amount_due":
		required = append(required, "amount")
	case "set_facts":
		required, optional = append(required, "amount", "due_date"), []string{"closing_date"}
	}
	if err := checkFields(action, given, required, optional...); err != nil {
		return pv, nil, err
	}
	v, card, _, err := svc.Statement(ctx, userID, id)
	if err != nil {
		return pv, nil, err
	}
	unit, err := svc.AmountOf(ctx, 0, card.Instrument)
	if err != nil {
		return pv, nil, err
	}
	due, err := minorMoney(unit, v.Summary.AmountDue)
	if err != nil {
		return pv, nil, err
	}
	unpaid, err := minorMoney(unit, v.Summary.Unpaid)
	if err != nil {
		return pv, nil, err
	}
	pv.Target = "Statement " + v.Input.Reference.String() + " of " + card.Name
	pv.Basis = due.Amount + ":" + unpaid.Amount
	date := svc.Today()
	if !in.Date.IsZero() {
		date = in.Date.Time
	}
	out := settleStatementOut{StatementID: id.String()}
	parse := func(field, s string) (money.Money, error) { return tool.ParsePositive(field, s, unit) }
	switch in.Action {
	case "pay":
		amount, err := parse("amount", in.Amount)
		if err != nil {
			return pv, nil, err
		}
		from, err := svc.Account(ctx, userID, fromID)
		if err != nil {
			return pv, nil, err
		}
		pv.Changes = []tool.Change{{Field: "amount", After: tool.MoneyValue(amount)}, {Field: "account", After: tool.TextValue(from.Name)}, {Field: "date", After: tool.DateValue(date)}}
		return pv, func() (settleStatementOut, error) {
			t, err := svc.PayStatement(ctx, userID, id, date, from.ID, amount)
			out.TransactionID = t.ID.String()
			return out, err
		}, nil
	case "finance":
		amount, err := parse("installment_amount", in.InstallmentAmount)
		if err != nil {
			return pv, nil, err
		}
		pv.Changes = []tool.Change{
			{Field: "installments", After: tool.TextValue(strconv.Itoa(in.InstallmentCount))},
			{Field: "amount", After: tool.MoneyValue(amount)},
			{Field: "date", After: tool.DateValue(date)},
		}
		return pv, func() (settleStatementOut, error) {
			t, _, err := svc.FinanceStatement(ctx, userID, id, date, in.InstallmentCount, amount)
			out.TransactionID = t.ID.String()
			return out, err
		}, nil
	case "confirm_amount_due":
		amount, err := parse("amount", in.Amount)
		if err != nil {
			return pv, nil, err
		}
		pv.Changes = []tool.Change{{Field: "amount", Before: tool.Value{Amount: due.Amount, Currency: due.Currency}, After: tool.MoneyValue(amount)}}
		return pv, func() (settleStatementOut, error) { return out, svc.ReconcileStatement(ctx, userID, id, amount) }, nil
	case "set_facts":
		amount, err := parse("amount", in.Amount)
		if err != nil {
			return pv, nil, err
		}
		f := app.StatementFacts{Due: in.DueDate.Time, Total: amount}
		pv.Changes = []tool.Change{{Field: "amount", After: tool.MoneyValue(amount)}, {Field: "due_on", After: tool.DateValue(in.DueDate.Time)}}
		if !in.ClosingDate.IsZero() {
			f.Closing = &in.ClosingDate.Time
			pv.Changes = append(pv.Changes, tool.Change{Field: "date", After: tool.DateValue(in.ClosingDate.Time)})
		}
		return pv, func() (settleStatementOut, error) { return out, svc.SetOwnerFacts(ctx, userID, id, f) }, nil
	default:
		pv.Changes = []tool.Change{{Field: "due_on", Before: tool.DateValue(v.Input.Due)}}
		return pv, func() (settleStatementOut, error) { return out, svc.RemoveOwnerFacts(ctx, userID, id) }, nil
	}
}
