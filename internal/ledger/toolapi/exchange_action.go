package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// planExchange names the ratio and the security a conversion, a spin-off or a right gives, the
// share of the cost a spin-off moves to it, and the price a right exercise pays (coverage rows
// E-06 and E-07).
func planExchange(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordCorporateActionIn,
	o *domain.ActionOrder,
	pv *tool.Preview,
) error {
	if err := planRatio(in, o, pv); err != nil {
		return err
	}

	o.NewInstrument = money.Currency(in.NewInstrument)
	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "instrument", After: tool.TextValue(in.NewInstrument)},
	)

	if in.Kind == "right_exercise" {
		return planRightPrice(ctx, svc, booksID, in, o, pv)
	}

	if in.CostPercent == "" {
		return nil
	}

	bp, ok := percentBP(in.CostPercent)
	if !ok || bp < 1 || bp > 9999 {
		return tool.InvalidArgument(
			"cost_percent",
			"must be above 0 and below 100, with at most 2 decimals",
		)
	}

	o.CostBP = bp

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "rate", After: tool.TextValue(in.CostPercent + "%")},
	)

	return nil
}

// planRightPrice reads the subscription price of a right exercise in the base currency and the
// account that pays it.
func planRightPrice(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordCorporateActionIn,
	o *domain.ActionOrder,
	pv *tool.Preview,
) error {
	settings, err := svc.Settings(ctx, booksID)
	if err != nil {
		return err
	}

	base, err := svc.AmountOf(ctx, 0, settings.BaseCurrency)
	if err != nil {
		return err
	}

	if o.Amount, err = tool.ParsePositive("amount", in.Amount, base); err != nil {
		return err
	}

	if in.CashAccountID != "" {
		if o.CashAccountID, err = uuid.Parse(in.CashAccountID); err != nil {
			return tool.InvalidArgument("cash_account_id", "is not a UUID")
		}
	}

	pv.Changes = append(pv.Changes, tool.Change{Field: "amount", After: tool.MoneyValue(o.Amount)})

	return nil
}
