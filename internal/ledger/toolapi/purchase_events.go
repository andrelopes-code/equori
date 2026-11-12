package toolapi

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func planRefund(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in handleCardPurchaseIn,
	ev purchaseEvent,
	pv tool.Preview,
) (tool.Preview, func() (handleCardPurchaseOut, error), error) {
	amount, err := tool.ParsePositive("amount", in.Amount, ev.unit)
	if err != nil {
		return pv, nil, err
	}

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "amount", After: tool.MoneyValue(amount)},
		purchaseDateChange(ev),
	)
	pv.Changes = withStatementChange(pv.Changes, ev.statement)

	return pv, func() (handleCardPurchaseOut, error) {
		return createdPurchase(
			svc.RefundPurchase(ctx, booksID, ev.tx.ID, ev.date, amount, ev.statement),
		)
	}, nil
}

func planOpenDispute(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	ev purchaseEvent,
	pv tool.Preview,
) (tool.Preview, func() (handleCardPurchaseOut, error), error) {
	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "status", After: tool.TextValue("disputed")},
		purchaseDateChange(ev),
	)

	return pv, func() (handleCardPurchaseOut, error) {
		_, err := svc.OpenDispute(ctx, booksID, ev.tx.ID, ev.date)
		return handleCardPurchaseOut{TransactionID: ev.tx.ID.String()}, err
	}, nil
}

func planResolveDispute(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in handleCardPurchaseIn,
	ev purchaseEvent,
	pv tool.Preview,
) (tool.Preview, func() (handleCardPurchaseOut, error), error) {
	disputes, err := svc.Disputes(ctx, booksID, ev.tx.ID)
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

	pv.Changes = append(pv.Changes, tool.Change{
		Field:  "status",
		Before: tool.TextValue("disputed"),
		After:  tool.TextValue(string(in.Outcome)),
	}, purchaseDateChange(ev))
	pv.Changes = withStatementChange(pv.Changes, ev.statement)

	return pv, func() (handleCardPurchaseOut, error) {
		d, err := svc.ResolveDispute(
			ctx,
			booksID,
			open.ID,
			ev.date,
			string(in.Outcome),
			ev.statement,
		)
		if d.RefundTransactionID != uuid.Nil {
			return handleCardPurchaseOut{TransactionID: d.RefundTransactionID.String()}, err
		}

		return handleCardPurchaseOut{TransactionID: ev.tx.ID.String()}, err
	}, nil
}

func planCancelInstallments(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	ev purchaseEvent,
	pv tool.Preview,
) (tool.Preview, func() (handleCardPurchaseOut, error), error) {
	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "status", After: tool.TextValue("cancelled")},
		purchaseDateChange(ev),
	)
	pv.Changes = withStatementChange(pv.Changes, ev.statement)

	return pv, func() (handleCardPurchaseOut, error) {
		return createdPurchase(svc.CancelPlan(ctx, booksID, ev.planID, ev.date, ev.statement))
	}, nil
}

func planAnticipateInstallments(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in handleCardPurchaseIn,
	ev purchaseEvent,
	pv tool.Preview,
) (tool.Preview, func() (handleCardPurchaseOut, error), error) {
	amount, err := tool.ParsePositive("amount", in.Amount, ev.unit)
	if err != nil {
		return pv, nil, err
	}

	target, err := anticipationTarget(ctx, svc, booksID, ev.accountID, ev.date, ev.statement)
	if err != nil {
		return pv, nil, err
	}

	installments := strconv.Itoa(in.FromInstallment) + "-" + strconv.Itoa(in.ToInstallment)
	pv.Changes = append(pv.Changes,
		tool.Change{Field: "installments", After: tool.TextValue(installments)},
		tool.Change{Field: "amount", After: tool.MoneyValue(amount)},
		tool.Change{Field: "statement", After: tool.TextValue(target.String())},
		purchaseDateChange(ev),
	)

	return pv, func() (handleCardPurchaseOut, error) {
		return createdPurchase(svc.AnticipatePlan(
			ctx, booksID, ev.planID, ev.date, in.FromInstallment, in.ToInstallment, target, amount,
		))
	}, nil
}

func purchaseDateChange(ev purchaseEvent) tool.Change {
	return tool.Change{Field: "date", After: tool.DateValue(ev.date)}
}

func withStatementChange(changes []tool.Change, statement *domain.ReferenceMonth) []tool.Change {
	if statement == nil {
		return changes
	}

	return append(
		changes,
		tool.Change{Field: "statement", After: tool.TextValue(statement.String())},
	)
}

func createdPurchase(t domain.Transaction, err error) (handleCardPurchaseOut, error) {
	return handleCardPurchaseOut{TransactionID: t.ID.String()}, err
}

func anticipationTarget(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	card uuid.UUID,
	date time.Time,
	given *domain.ReferenceMonth,
) (domain.ReferenceMonth, error) {
	if given != nil {
		return *given, nil
	}

	return nextOpenStatement(ctx, svc, booksID, card, date)
}

// purchaseIdentity names the purchase a card event acts on, as record_transaction names a purchase.
func purchaseIdentity(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	t domain.Transaction,
	card uuid.UUID,
) ([]tool.Change, error) {
	account, err := svc.Account(ctx, booksID, card)
	if err != nil {
		return nil, err
	}

	changes := []tool.Change{{Field: "description", After: tool.TextValue(t.Description)}}

	if t.PayeeID != uuid.Nil {
		names, err := svc.PayeeNames(ctx, booksID, []uuid.UUID{t.PayeeID})
		if err != nil {
			return nil, err
		}

		changes = append(
			changes,
			tool.Change{Field: "payee", After: tool.TextValue(names[t.PayeeID])},
		)
	}

	return append(changes, tool.Change{Field: "account", After: tool.TextValue(account.Name)}), nil
}
