package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// correction is the trade or income that a record_investment proposal corrects (A227 IC12);
// its zero value records a new transaction.
type correction struct {
	id     uuid.UUID
	was    domain.Transaction
	reason string
}

// loadCorrection reads the transaction that in names; its version is the one the preview read.
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

	return correction{id: id, was: t, reason: in.Reason}, nil
}

func (c correction) describe(pv *tool.Preview, kind recordInvestmentKind) {
	if c.id == uuid.Nil {
		return
	}

	pv.Action = "record_investment.correct"
	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "reason", After: tool.TextValue(c.reason)},
		tool.Change{Field: "kind", After: tool.TextValue(string(kind))},
	)
}

// compareTrade states the value before of each change the correction of a trade alters
// (investment proposals design, IP8).
func (c correction) compareTrade(pv *tool.Preview) {
	if c.id == uuid.Nil {
		return
	}

	t := c.was.Trade
	before := map[string]tool.Value{
		"quantity":   tool.TextValue(t.Quantity.Decimal()),
		"price":      tool.TextValue(t.UnitPrice.String()),
		"fees":       tool.MoneyValue(t.Fees),
		"taxes":      tool.MoneyValue(t.Taxes),
		"amount":     tool.MoneyValue(t.Gross),
		"net":        c.cashBefore(t.CashAccountID),
		"settlement": tool.DateValue(c.was.SettlementDate()),
	}
	c.compare(pv, before)
}

// compareIncome states the value before of each change the correction of an income alters.
func (c correction) compareIncome(pv *tool.Preview) {
	if c.id == uuid.Nil {
		return
	}

	i := c.was.Income
	c.compare(pv, map[string]tool.Value{
		"amount":      tool.MoneyValue(i.Gross),
		"withheld":    tool.MoneyValue(i.Withheld),
		"net":         c.cashBefore(i.CashAccountID),
		"income_type": tool.TextValue(string(i.Type)),
	})
}

// compare sets Before on the changes whose value differs; a price compares without the zeros that
// end it.
func (c correction) compare(pv *tool.Preview, before map[string]tool.Value) {
	before["date"] = tool.DateValue(c.was.Date)

	for i, change := range pv.Changes {
		was, ok := before[change.Field]
		if ok && !sameValue(was, change.After) {
			pv.Changes[i].Before = was
		}
	}
}

func (c correction) cashBefore(cash uuid.UUID) tool.Value {
	for _, p := range c.was.Postings {
		if p.AccountID == cash {
			return tool.MoneyValue(p.Amount)
		}
	}

	return tool.Value{}
}

func sameValue(a, b tool.Value) bool {
	if a == b {
		return true
	}

	x, errX := money.ParseRate(a.Text)
	y, errY := money.ParseRate(b.Text)

	return errX == nil && errY == nil && x.Reduced() == y.Reduced()
}

// trade returns the write of a trade order: a record, or the correction of c.
func (c correction) trade(
	svc *app.Service,
) func(context.Context, int64, domain.TradeOrder) (domain.Transaction, error) {
	if c.id == uuid.Nil {
		return svc.RecordTrade
	}

	return func(ctx context.Context, booksID int64, o domain.TradeOrder) (domain.Transaction, error) {
		return svc.CorrectTrade(ctx, booksID, c.id, c.was.Version, o, c.reason)
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
		return svc.CorrectIncome(ctx, booksID, c.id, c.was.Version, o, c.reason)
	}
}
