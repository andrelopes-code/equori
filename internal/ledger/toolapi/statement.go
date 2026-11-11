package toolapi

import (
	"context"
	"strconv"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getStatementIn struct {
	StatementID string `json:"statement_id" jsonschema:"ID of the statement, from get_account_details"`
	tool.PageArgs
}

type institutionFactView struct {
	DueDate tool.Date  `json:"due_date"`
	Total   tool.Money `json:"total"`
	Minimum tool.Money `json:"minimum,omitzero"`
}

type statementLineView struct {
	TransactionID string     `json:"transaction_id"`
	Date          tool.Date  `json:"date"`
	Description   string     `json:"description"`
	CardRole      string     `json:"card_role"`
	Amount        tool.Money `json:"amount"`
	Installment   string     `json:"installment,omitzero" jsonschema:"n/N for an installment"`
	key           string
}

type getStatementOut struct {
	StatementID string              `json:"statement_id"`
	AccountID   string              `json:"account_id"`
	AccountName string              `json:"account_name"`
	Reference   string              `json:"reference" jsonschema:"YYYY-MM"`
	Status      string              `json:"status"`
	ClosingDate tool.Date           `json:"closing_date"`
	DueDate     tool.Date           `json:"due_date"`
	Opening     tool.Money          `json:"opening"`
	Charges     tool.Money          `json:"charges"`
	Credits     tool.Money          `json:"credits"`
	Payments    tool.Money          `json:"payments"`
	AmountDue   tool.Money          `json:"amount_due"`
	Unpaid      tool.Money          `json:"unpaid"`
	Reconciled  bool                `json:"reconciled"`
	Institution institutionFactView `json:"institution,omitzero"`
	Lines       []statementLineView `json:"lines"`
	NextCursor  string              `json:"next_cursor,omitzero" jsonschema:"present when more lines follow; pass it as cursor"`
}

func getStatement(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_statement",
		Description: "Returns one credit card statement with its amounts, status, dates and every line: charges, credits, payments and installments. " +
			"Use it to explain a statement or check its lines. " +
			"Do not use it to list statements: get_account_details lists them with their IDs.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, booksID int64, in getStatementIn) (getStatementOut, error) {
		return runGetStatement(ctx, svc, booksID, in)
	})
}

func runGetStatement(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in getStatementIn,
) (getStatementOut, error) {
	id, err := requiredID(in.StatementID, "statement_id")
	if err != nil {
		return getStatementOut{}, err
	}

	v, a, postings, err := svc.Statement(ctx, booksID, id)
	if err != nil {
		return getStatementOut{}, err
	}

	unit, err := svc.AmountOf(ctx, 0, a.Instrument)
	if err != nil {
		return getStatementOut{}, err
	}

	amounts := &statementAmounts{unit: unit}
	out := statementHeader(v, a, amounts)
	lines := statementLines(postings, amounts)

	if amounts.err != nil {
		return getStatementOut{}, amounts.err
	}

	out.Lines, out.NextCursor, err = tool.PageOf(lines, func(l statementLineView) string { return l.key }, in.PageArgs)

	return out, err
}

// statementAmounts converts minor units and keeps the first conversion error.
type statementAmounts struct {
	unit money.Money
	err  error
}

func (c *statementAmounts) of(n int64) tool.Money {
	m, e := minorMoney(c.unit, n)
	if c.err == nil {
		c.err = e
	}

	return m
}

func statementHeader(v app.StatementView, a domain.Account, amounts *statementAmounts) getStatementOut {
	s := v.Summary

	out := getStatementOut{
		StatementID: v.ID.String(), AccountID: a.ID.String(), AccountName: a.Name, Reference: v.Input.Reference.String(),
		Status: s.Status, ClosingDate: tool.DateOf(v.Input.Closing), DueDate: tool.DateOf(v.Input.Due),
		Opening: amounts.of(s.Opening), Charges: amounts.of(s.Charges), Credits: amounts.of(s.Credits),
		Payments: amounts.of(s.Payments), AmountDue: amounts.of(s.AmountDue), Unpaid: amounts.of(s.Unpaid),
		Reconciled: v.Reconciled,
	}
	if f := v.Fact; f != nil {
		out.Institution = institutionFactView{DueDate: tool.DateOf(f.Due), Total: amounts.of(f.Total)}
		if f.Minimum != nil {
			out.Institution.Minimum = amounts.of(*f.Minimum)
		}
	}

	return out
}

func statementLines(postings []app.StatementPosting, amounts *statementAmounts) []statementLineView {
	lines := make([]statementLineView, len(postings))
	for i, p := range postings {
		lines[i] = statementLineView{
			TransactionID: p.TransactionID.String(), Date: tool.DateOf(p.Date), Description: p.Description,
			CardRole: p.CardRole, Amount: amounts.of(p.Amount), key: p.TransactionID.String() + ":" + strconv.Itoa(i),
		}
		if p.Installment != nil {
			lines[i].Installment = strconv.Itoa(p.Installment.Number) + "/" + strconv.Itoa(p.Installment.Count)
		}
	}

	return lines
}
