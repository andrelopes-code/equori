package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// correction is the trade or income that a record_investment proposal corrects (A227 IC12);
// its zero value records a new transaction.
type correction struct {
	id      uuid.UUID
	version int
	reason  string
}

// loadCorrection reads the transaction that in names; the version is the one the preview read.
func loadCorrection(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordInvestmentIn,
) (correction, error) {
	if in.TransactionID == "" {
		if in.Reason != "" {
			return correction{}, tool.InvalidArgument("reason", "is read only with transaction_id")
		}

		return correction{}, nil
	}

	id, err := optionalID(in.TransactionID, "transaction_id")
	if err != nil {
		return correction{}, err
	}

	if in.Reason == "" {
		return correction{}, tool.InvalidArgument("reason", "is required with transaction_id")
	}

	t, err := svc.Transaction(ctx, booksID, id)
	if err != nil {
		return correction{}, err
	}

	if (in.Kind == "income" && t.Income == nil) || (in.Kind != "income" && t.Trade == nil) {
		return correction{}, app.ErrNotFound
	}

	return correction{id: id, version: t.Version, reason: in.Reason}, nil
}

func (c correction) describe(pv *tool.Preview) {
	if c.id == uuid.Nil {
		return
	}

	pv.Action = "record_investment.correct"
	pv.Changes = append(pv.Changes, tool.Change{Field: "reason", After: tool.TextValue(c.reason)})
}

// trade returns the write of a trade order: a record, or the correction of c.
func (c correction) trade(
	svc *app.Service,
) func(context.Context, int64, domain.TradeOrder) (domain.Transaction, error) {
	if c.id == uuid.Nil {
		return svc.RecordTrade
	}

	return func(ctx context.Context, booksID int64, o domain.TradeOrder) (domain.Transaction, error) {
		return svc.CorrectTrade(ctx, booksID, c.id, c.version, o, c.reason)
	}
}

// income returns the write of an income order: a record, or the correction of c.
func (c correction) income(
	svc *app.Service,
) func(context.Context, int64, domain.IncomeOrder) (domain.Transaction, error) {
	if c.id == uuid.Nil {
		return svc.RecordIncome
	}

	return func(ctx context.Context, booksID int64, o domain.IncomeOrder) (domain.Transaction, error) {
		return svc.CorrectIncome(ctx, booksID, c.id, c.version, o, c.reason)
	}
}
