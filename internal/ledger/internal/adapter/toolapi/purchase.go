package toolapi

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type handleCardPurchaseAction string

func (handleCardPurchaseAction) Values() []string {
	return []string{"refund", "open_dispute", "resolve_dispute", "cancel_installments", "anticipate_installments"}
}

type handleCardPurchaseOutcome string

func (handleCardPurchaseOutcome) Values() []string { return []string{"won", "lost"} }

type handleCardPurchaseIn struct {
	TransactionID   string                    `json:"transaction_id" jsonschema:"the card purchase, from search_transactions"`
	Action          handleCardPurchaseAction  `json:"action" jsonschema:"operation to propose"`
	Date            tool.Date                 `json:"date,omitzero" jsonschema:"date of the event; today when absent"`
	Amount          string                    `json:"amount,omitzero" jsonschema:"for refund and anticipate_installments: positive amount in the card's currency"`
	Outcome         handleCardPurchaseOutcome `json:"outcome,omitzero" jsonschema:"for resolve_dispute: won refunds the remaining charged amount"`
	FromInstallment int                       `json:"from_installment,omitzero" jsonschema:"for anticipate_installments: first installment number paid early"`
	ToInstallment   int                       `json:"to_installment,omitzero" jsonschema:"for anticipate_installments: last installment number paid early"`
	Statement       string                    `json:"statement,omitzero" jsonschema:"statement month the credit or the anticipated installments go to; the next open statement when absent; written YYYY-MM"`
}

type handleCardPurchaseOut struct {
	TransactionID string `json:"transaction_id"`
}

func handleCardPurchase(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "handle_card_purchase",
		Description: "Proposes an event on a card purchase: a full or partial refund, opening or resolving a dispute, cancelling the remaining installments, or paying installments early. " +
			"Use it when the user reports a refund, a chargeback, a cancelled installment purchase or an early payment of installments. " +
			"Do not use it to record a new purchase: record_transaction does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, userID int64, in handleCardPurchaseIn) (tool.Preview, error) {
		pv, _, err := planPurchase(ctx, svc, userID, in)
		return pv, err
	}, func(ctx context.Context, userID int64, in handleCardPurchaseIn) (handleCardPurchaseOut, error) {
		_, run, err := planPurchase(ctx, svc, userID, in)
		if err != nil {
			return handleCardPurchaseOut{}, err
		}
		return run()
	})
}

// nextOpenStatement returns the first open statement of the card from the month of date.
func nextOpenStatement(ctx context.Context, svc *app.Service, userID int64, card uuid.UUID, date time.Time) (domain.ReferenceMonth, error) {
	from := domain.MonthOf(date)
	views, _, _, err := svc.Statements(ctx, userID, card, &from, nil, page.Request[app.StatementKey]{Limit: page.MaxLimit})
	if err != nil {
		return from, err
	}
	for _, v := range views {
		if v.Summary.Status == "open" {
			return v.Input.Reference, nil
		}
	}
	return from.Add(1), nil
}

func planPurchase(ctx context.Context, svc *app.Service, userID int64, in handleCardPurchaseIn) (tool.Preview, func() (handleCardPurchaseOut, error), error) {
	action := string(in.Action)
	pv := tool.Preview{Action: "handle_card_purchase"}
	id, err := requiredID(in.TransactionID, "transaction_id")
	if err != nil {
		return pv, nil, err
	}
	given := map[string]bool{
		"transaction_id": true, "date": !in.Date.IsZero(), "amount": in.Amount != "", "outcome": in.Outcome != "",
		"from_installment": in.FromInstallment != 0, "to_installment": in.ToInstallment != 0, "statement": in.Statement != "",
	}
	required := []string{"transaction_id"}
	var optional []string
	switch in.Action {
	case "refund":
		required, optional = append(required, "amount"), []string{"date", "statement"}
	case "open_dispute":
		optional = []string{"date"}
	case "resolve_dispute":
		required, optional = append(required, "outcome"), []string{"date", "statement"}
	case "cancel_installments":
		optional = []string{"date", "statement"}
	default:
		required, optional = append(required, "amount", "from_installment", "to_installment"), []string{"date", "statement"}
	}
	if err := checkFields(action, given, required, optional...); err != nil {
		return pv, nil, err
	}
	t, err := svc.Transaction(ctx, userID, id)
	if err != nil {
		return pv, nil, err
	}
	var cardPosting *domain.Posting
	var planID uuid.UUID
	for i, p := range t.Postings {
		if p.CardRole == "" {
			continue
		}
		if cardPosting == nil {
			cardPosting = &t.Postings[i]
		}
		if p.Installment != nil {
			planID = p.Installment.PlanID
		}
	}
	if cardPosting == nil {
		return pv, nil, tool.InvalidArgument("transaction_id", "is not a card purchase")
	}
	pv.Target, pv.Basis = "Purchase "+targetText(t), basisOf(t)
	date := svc.Today()
	if !in.Date.IsZero() {
		date = in.Date.Time
	}
	var statement *domain.ReferenceMonth
	if in.Statement != "" {
		m, err := domain.ParseReferenceMonth(in.Statement)
		if err != nil {
			return pv, nil, tool.InvalidArgument("statement", "must be YYYY-MM")
		}
		statement = &m
	}
	unit, err := svc.AmountOf(ctx, 0, cardPosting.Amount.Currency())
	if err != nil {
		return pv, nil, err
	}
	text := tool.TextValue
	dateChange := tool.Change{Field: "date", After: tool.DateValue(date)}
	statementChange := func() {
		if statement != nil {
			pv.Changes = append(pv.Changes, tool.Change{Field: "statement", After: text(statement.String())})
		}
	}
	created := func(t domain.Transaction, err error) (handleCardPurchaseOut, error) {
		return handleCardPurchaseOut{TransactionID: t.ID.String()}, err
	}
	switch in.Action {
	case "refund":
		amount, err := tool.ParsePositive("amount", in.Amount, unit)
		if err != nil {
			return pv, nil, err
		}
		pv.Changes = []tool.Change{{Field: "amount", After: tool.MoneyValue(amount)}, dateChange}
		statementChange()
		return pv, func() (handleCardPurchaseOut, error) {
			return created(svc.RefundPurchase(ctx, userID, t.ID, date, amount, statement))
		}, nil
	case "open_dispute":
		pv.Changes = []tool.Change{{Field: "status", After: text("disputed")}, dateChange}
		return pv, func() (handleCardPurchaseOut, error) {
			_, err := svc.OpenDispute(ctx, userID, t.ID, date)
			return handleCardPurchaseOut{TransactionID: t.ID.String()}, err
		}, nil
	case "resolve_dispute":
		disputes, err := svc.Disputes(ctx, userID, t.ID)
		if err != nil {
			return pv, nil, err
		}
		var open *app.Dispute
		for i, d := range disputes {
			if d.ResolvedOn == nil {
				open = &disputes[i]
			}
		}
		if open == nil {
			return pv, nil, tool.InvalidArgument("transaction_id", "has no open dispute")
		}
		pv.Changes = []tool.Change{{Field: "status", Before: text("disputed"), After: text(string(in.Outcome))}, dateChange}
		statementChange()
		return pv, func() (handleCardPurchaseOut, error) {
			d, err := svc.ResolveDispute(ctx, userID, open.ID, date, string(in.Outcome), statement)
			if d.RefundTransactionID != uuid.Nil {
				return handleCardPurchaseOut{TransactionID: d.RefundTransactionID.String()}, err
			}
			return handleCardPurchaseOut{TransactionID: t.ID.String()}, err
		}, nil
	}
	if planID == uuid.Nil {
		return pv, nil, tool.InvalidArgument("transaction_id", "is not an installment purchase")
	}
	if in.Action == "cancel_installments" {
		pv.Changes = []tool.Change{{Field: "status", After: text("cancelled")}, dateChange}
		statementChange()
		return pv, func() (handleCardPurchaseOut, error) {
			return created(svc.CancelPlan(ctx, userID, planID, date, statement))
		}, nil
	}
	amount, err := tool.ParsePositive("amount", in.Amount, unit)
	if err != nil {
		return pv, nil, err
	}
	target, err := anticipationTarget(ctx, svc, userID, cardPosting.AccountID, date, statement)
	if err != nil {
		return pv, nil, err
	}
	pv.Changes = []tool.Change{
		{Field: "installments", After: text(strconv.Itoa(in.FromInstallment) + "-" + strconv.Itoa(in.ToInstallment))},
		{Field: "amount", After: tool.MoneyValue(amount)},
		{Field: "statement", After: text(target.String())},
		dateChange,
	}
	return pv, func() (handleCardPurchaseOut, error) {
		return created(svc.AnticipatePlan(ctx, userID, planID, date, in.FromInstallment, in.ToInstallment, target, amount))
	}, nil
}

func anticipationTarget(ctx context.Context, svc *app.Service, userID int64, card uuid.UUID, date time.Time, given *domain.ReferenceMonth) (domain.ReferenceMonth, error) {
	if given != nil {
		return *given, nil
	}
	return nextOpenStatement(ctx, svc, userID, card, date)
}
