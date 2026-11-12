package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
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
	}, func(ctx context.Context, booksID int64, in handleCardPurchaseIn) (tool.Preview, error) {
		pv, _, err := planPurchase(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in handleCardPurchaseIn) (handleCardPurchaseOut, error) {
		_, run, err := planPurchase(ctx, svc, booksID, in)
		if err != nil {
			return handleCardPurchaseOut{}, err
		}

		return run()
	})
}

// nextOpenStatement returns the first open statement of the card from the month of date.
func nextOpenStatement(ctx context.Context, svc *app.Service, booksID int64, card uuid.UUID, date time.Time) (domain.ReferenceMonth, error) {
	from := domain.MonthOf(date)

	views, _, _, err := svc.Statements(ctx, booksID, card, &from, nil, page.Request[app.StatementKey]{Limit: page.MaxLimit})
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

type purchaseEvent struct {
	tx        domain.Transaction
	accountID uuid.UUID
	planID    uuid.UUID
	date      time.Time
	statement *domain.ReferenceMonth
	unit      money.Money
}

func planPurchase(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in handleCardPurchaseIn,
) (tool.Preview, func() (handleCardPurchaseOut, error), error) {
	pv := tool.Preview{Action: "handle_card_purchase"}

	id, err := requiredID(in.TransactionID, "transaction_id")
	if err != nil {
		return pv, nil, err
	}

	if err := checkPurchaseFields(in); err != nil {
		return pv, nil, err
	}

	t, err := svc.Transaction(ctx, booksID, id)
	if err != nil {
		return pv, nil, err
	}

	cardPosting, planID := cardPostingOf(t)
	if cardPosting == nil {
		return pv, nil, tool.InvalidArgument("transaction_id", "is not a card purchase")
	}

	pv.Target, pv.Basis = "Purchase "+targetText(t), basisOf(t)

	ev, err := resolvePurchaseEvent(ctx, svc, in, t, cardPosting, planID)
	if err != nil {
		return pv, nil, err
	}

	pv.Changes, err = purchaseIdentity(ctx, svc, booksID, t, cardPosting.AccountID)
	if err != nil {
		return pv, nil, err
	}

	switch in.Action {
	case "refund":
		return planRefund(ctx, svc, booksID, in, ev, pv)
	case "open_dispute":
		return planOpenDispute(ctx, svc, booksID, ev, pv)
	case "resolve_dispute":
		return planResolveDispute(ctx, svc, booksID, in, ev, pv)
	}

	return planInstallmentEvent(ctx, svc, booksID, in, ev, pv)
}

func planInstallmentEvent(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in handleCardPurchaseIn,
	ev purchaseEvent,
	pv tool.Preview,
) (tool.Preview, func() (handleCardPurchaseOut, error), error) {
	if ev.planID == uuid.Nil {
		return pv, nil, tool.InvalidArgument("transaction_id", "is not an installment purchase")
	}

	if in.Action == "cancel_installments" {
		return planCancelInstallments(ctx, svc, booksID, ev, pv)
	}

	return planAnticipateInstallments(ctx, svc, booksID, in, ev, pv)
}

func checkPurchaseFields(in handleCardPurchaseIn) error {
	given := map[string]bool{
		"transaction_id": true, "date": !in.Date.IsZero(), "amount": in.Amount != "", "outcome": in.Outcome != "",
		"from_installment": in.FromInstallment != 0, "to_installment": in.ToInstallment != 0,
		"statement": in.Statement != "",
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

	return checkFields(string(in.Action), given, required, optional...)
}

// cardPostingOf returns the first card posting of the purchase, nil when it has none, and the
// ID of its installment plan, uuid.Nil when it has none.
func cardPostingOf(t domain.Transaction) (*domain.Posting, uuid.UUID) {
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

	return cardPosting, planID
}

func resolvePurchaseEvent(
	ctx context.Context,
	svc *app.Service,
	in handleCardPurchaseIn,
	t domain.Transaction,
	cardPosting *domain.Posting,
	planID uuid.UUID,
) (purchaseEvent, error) {
	date := svc.Today(ctx)
	if !in.Date.IsZero() {
		date = in.Date.Time
	}

	var statement *domain.ReferenceMonth
	if in.Statement != "" {
		m, err := domain.ParseReferenceMonth(in.Statement)
		if err != nil {
			return purchaseEvent{}, tool.InvalidArgument("statement", "must be YYYY-MM")
		}

		statement = &m
	}

	unit, err := svc.AmountOf(ctx, 0, cardPosting.Amount.Currency())
	if err != nil {
		return purchaseEvent{}, err
	}

	return purchaseEvent{
		tx:        t,
		accountID: cardPosting.AccountID,
		planID:    planID,
		date:      date,
		statement: statement,
		unit:      unit,
	}, nil
}
