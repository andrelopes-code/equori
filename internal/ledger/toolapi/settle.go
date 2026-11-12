package toolapi

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type settleStatementAction string

func (settleStatementAction) Values() []string {
	return []string{
		"pay",
		"finance",
		"confirm_amount_due",
		"set_facts",
		"remove_facts",
		"defer_postings",
	}
}

type settleStatementIn struct {
	StatementID       string                `json:"statement_id"                jsonschema:"statement from get_account_details"`
	Action            settleStatementAction `json:"action"                      jsonschema:"operation to propose"`
	Date              tool.Date             `json:"date,omitzero"               jsonschema:"for pay and finance: date of the operation; today when absent"`
	Amount            string                `json:"amount,omitzero"             jsonschema:"for pay: amount paid; for confirm_amount_due and set_facts: the institution's total; positive, in the card's currency"`
	FromAccountID     string                `json:"from_account_id,omitzero"    jsonschema:"for pay: account the payment leaves"`
	InstallmentCount  int                   `json:"installment_count,omitzero"  jsonschema:"for finance: number of installments"`
	InstallmentAmount string                `json:"installment_amount,omitzero" jsonschema:"for finance: positive amount of each installment"`
	DueDate           tool.Date             `json:"due_date,omitzero"           jsonschema:"for set_facts: due date the institution states"`
	ClosingDate       tool.Date             `json:"closing_date,omitzero"       jsonschema:"for set_facts: closing date the institution states"`
	Minimum           string                `json:"minimum,omitzero"            jsonschema:"for set_facts: minimum payment the institution states"`
	TransactionIDs    []string              `json:"transaction_ids,omitzero"    jsonschema:"for defer_postings: transactions whose card posting moves to the next statement"`
}

type settleStatementOut struct {
	StatementID   string `json:"statement_id"`
	TransactionID string `json:"transaction_id,omitzero"`
}

func settleStatement(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "settle_statement",
		Description: "Proposes an action on a credit card statement: pay it from an account, finance its unpaid amount in installments, confirm the amount the institution charges, record or remove the institution's due date and total, or move postings the institution billed on the next statement. " +
			"Use it when the user pays a card bill or reports what the bank's statement says. " +
			"Do not use it for one purchase: handle_card_purchase does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in settleStatementIn) (tool.Preview, error) {
		pv, _, err := planSettle(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in settleStatementIn) (settleStatementOut, error) {
		_, run, err := planSettle(ctx, svc, booksID, in)
		if err != nil {
			return settleStatementOut{}, err
		}

		return run()
	})
}

func planSettle(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in settleStatementIn,
) (tool.Preview, func() (settleStatementOut, error), error) {
	pv := tool.Preview{Action: "settle_statement"}

	id, err := requiredID(in.StatementID, "statement_id")
	if err != nil {
		return pv, nil, err
	}

	fromID, err := optionalID(in.FromAccountID, "from_account_id")
	if err != nil {
		return pv, nil, err
	}

	if err = checkSettleFields(in); err != nil {
		return pv, nil, err
	}

	v, card, _, err := svc.Statement(ctx, booksID, id)
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

	date := svc.Today(ctx)
	if !in.Date.IsZero() {
		date = in.Date.Time
	}

	step := settleStep{
		svc:     svc,
		booksID: booksID,
		in:      in,
		id:      id,
		fromID:  fromID,
		view:    v,
		due:     due,
		unit:    unit,
		date:    date,
	}

	return step.plan(ctx, pv)
}

func checkSettleFields(in settleStatementIn) error {
	action := string(in.Action)
	given := map[string]bool{
		"statement_id":       true,
		"date":               !in.Date.IsZero(),
		"amount":             in.Amount != "",
		"from_account_id":    in.FromAccountID != "",
		"installment_count":  in.InstallmentCount != 0,
		"installment_amount": in.InstallmentAmount != "",
		"due_date":           !in.DueDate.IsZero(),
		"closing_date":       !in.ClosingDate.IsZero(),
		"minimum":            in.Minimum != "",
		"transaction_ids":    len(in.TransactionIDs) > 0,
	}
	required := []string{"statement_id"}

	var optional []string
	switch in.Action {
	case "pay":
		required, optional = append(required, "amount", "from_account_id"), []string{"date"}
	case "finance":
		required, optional = append(
			required,
			"installment_count",
			"installment_amount",
		), []string{
			"date",
		}
	case "confirm_amount_due":
		required = append(required, "amount")
	case "set_facts":
		required, optional = append(
			required,
			"amount",
			"due_date",
		), []string{
			"closing_date",
			"minimum",
		}
	case "defer_postings":
		required = append(required, "transaction_ids")
	}

	return checkFields(action, given, required, optional...)
}

// settleStep holds the resolved inputs that every action of settle_statement shares.
type settleStep struct {
	svc     *app.Service
	booksID int64
	in      settleStatementIn
	id      uuid.UUID
	fromID  uuid.UUID
	view    app.StatementView
	due     tool.Money
	unit    money.Money
	date    time.Time
}

func (s settleStep) plan(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (settleStatementOut, error), error) {
	switch s.in.Action {
	case "pay":
		return s.pay(ctx, pv)
	case "finance":
		return s.finance(ctx, pv)
	case "confirm_amount_due":
		return s.confirmAmountDue(ctx, pv)
	case "set_facts":
		return s.setFacts(ctx, pv)
	case "defer_postings":
		return s.deferPostings(ctx, pv)
	default:
		return s.removeFacts(ctx, pv)
	}
}

func (s settleStep) pay(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (settleStatementOut, error), error) {
	out := settleStatementOut{StatementID: s.id.String()}

	amount, err := s.parse("amount", s.in.Amount)
	if err != nil {
		return pv, nil, err
	}

	from, err := s.svc.Account(ctx, s.booksID, s.fromID)
	if err != nil {
		return pv, nil, err
	}

	pv.Changes = []tool.Change{
		{Field: "amount", After: tool.MoneyValue(amount)},
		{Field: "account", After: tool.TextValue(from.Name)},
		{Field: "date", After: tool.DateValue(s.date)},
	}

	return pv, func() (settleStatementOut, error) {
		t, err := s.svc.PayStatement(ctx, s.booksID, s.id, s.date, from.ID, amount)
		out.TransactionID = t.ID.String()

		return out, err
	}, nil
}

func (s settleStep) finance(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (settleStatementOut, error), error) {
	out := settleStatementOut{StatementID: s.id.String()}

	amount, err := s.parse("installment_amount", s.in.InstallmentAmount)
	if err != nil {
		return pv, nil, err
	}

	pv.Changes = []tool.Change{
		{Field: "installments", After: tool.TextValue(strconv.Itoa(s.in.InstallmentCount))},
		{Field: "amount", After: tool.MoneyValue(amount)},
		{Field: "date", After: tool.DateValue(s.date)},
	}

	return pv, func() (settleStatementOut, error) {
		t, _, err := s.svc.FinanceStatement(
			ctx,
			s.booksID,
			s.id,
			s.date,
			s.in.InstallmentCount,
			amount,
		)
		out.TransactionID = t.ID.String()

		return out, err
	}, nil
}

func (s settleStep) confirmAmountDue(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (settleStatementOut, error), error) {
	out := settleStatementOut{StatementID: s.id.String()}

	amount, err := s.parse("amount", s.in.Amount)
	if err != nil {
		return pv, nil, err
	}

	pv.Changes = []tool.Change{
		{
			Field:  "amount",
			Before: tool.Value{Amount: s.due.Amount, Currency: s.due.Currency},
			After:  tool.MoneyValue(amount),
		},
	}

	return pv, func() (settleStatementOut, error) { return out, s.svc.ReconcileStatement(ctx, s.booksID, s.id, amount) }, nil
}

func (s settleStep) setFacts(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (settleStatementOut, error), error) {
	in := s.in
	out := settleStatementOut{StatementID: s.id.String()}

	amount, err := s.parse("amount", in.Amount)
	if err != nil {
		return pv, nil, err
	}

	f := app.StatementFacts{Due: in.DueDate.Time, Total: amount}

	pv.Changes = []tool.Change{
		{Field: "amount", After: tool.MoneyValue(amount)},
		{Field: "due_on", After: tool.DateValue(in.DueDate.Time)},
	}
	if !in.ClosingDate.IsZero() {
		f.Closing = &in.ClosingDate.Time
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "date", After: tool.DateValue(in.ClosingDate.Time)},
		)
	}

	if in.Minimum != "" {
		minimum, err := s.parse("minimum", in.Minimum)
		if err != nil {
			return pv, nil, err
		}

		f.Minimum = &minimum
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "limit", After: tool.MoneyValue(minimum)},
		)
	}

	return pv, func() (settleStatementOut, error) { return out, s.svc.SetOwnerFacts(ctx, s.booksID, s.id, f) }, nil
}

func (s settleStep) deferPostings(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (settleStatementOut, error), error) {
	out := settleStatementOut{StatementID: s.id.String()}

	txIDs := make([]uuid.UUID, len(s.in.TransactionIDs))

	var err error
	for i, raw := range s.in.TransactionIDs {
		if txIDs[i], err = requiredID(raw, "transaction_ids"); err != nil {
			return pv, nil, err
		}
	}

	pv.Changes = []tool.Change{
		{
			Field:  "statement",
			Before: tool.TextValue(s.view.Input.Reference.String()),
			After:  tool.TextValue(s.view.Input.Reference.Add(1).String()),
		},
	}

	return pv, func() (settleStatementOut, error) { return out, s.svc.DeferPostings(ctx, s.booksID, s.id, txIDs) }, nil
}

func (s settleStep) removeFacts(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (settleStatementOut, error), error) {
	out := settleStatementOut{StatementID: s.id.String()}

	pv.Changes = []tool.Change{{Field: "due_on", Before: tool.DateValue(s.view.Input.Due)}}

	return pv, func() (settleStatementOut, error) { return out, s.svc.RemoveOwnerFacts(ctx, s.booksID, s.id) }, nil
}

func (s settleStep) parse(field, text string) (money.Money, error) {
	return tool.ParsePositive(field, text, s.unit)
}
