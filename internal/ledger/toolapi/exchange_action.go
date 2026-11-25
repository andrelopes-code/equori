package toolapi

import (
	"context"
	"strconv"

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

// planRightPrice reads the amount of a right exercise or a capital return in the base currency and
// the cash account that pays or receives it.
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

	net := o.Amount
	if in.Kind == "right_exercise" {
		net = net.Neg()
	}

	appendMoneyChange(pv, "amount", &o.Amount)
	appendMoneyChange(pv, "net", &net)

	return appendActionCash(ctx, svc, booksID, o, pv)
}

// appendActionCash names the cash account that pays or receives the money of an action.
func appendActionCash(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	o *domain.ActionOrder,
	pv *tool.Preview,
) error {
	var cash investmentTarget

	ids := investmentIDs{account: o.AccountID, brokerage: o.BrokerageID, cash: o.CashAccountID}
	if _, err := resolveTargetCash(ctx, svc, booksID, ids, &cash); err != nil {
		return err
	}

	if cash.cashName != "" {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "account", After: tool.TextValue(cash.cashName)},
		)
	}

	return nil
}

func planRatio(in recordCorporateActionIn, o *domain.ActionOrder, pv *tool.Preview) error {
	o.RatioFrom, o.RatioTo = in.RatioFrom, in.RatioTo
	ratio := strconv.FormatInt(in.RatioFrom, 10) + " : " + strconv.FormatInt(in.RatioTo, 10)
	pv.Changes = append(pv.Changes, tool.Change{Field: "ratio", After: tool.TextValue(ratio)})

	if in.UnitCost == "" {
		return nil
	}

	cost, err := money.ParseRate(in.UnitCost)
	if err != nil {
		return tool.InvalidArgument(
			"unit_cost",
			"must be a positive decimal with at most 12 decimals",
		)
	}

	o.UnitCost = &cost
	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "price", After: tool.TextValue(cost.String())},
	)

	return nil
}

func planUnitTax(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordCorporateActionIn,
	instrument money.Currency,
	o *domain.ActionOrder,
	pv *tool.Preview,
) error {
	// The operation takes a ratio for every kind; a unit tax does not read it.
	o.RatioFrom, o.RatioTo = 1, 1

	unit, err := svc.AmountOf(ctx, 0, instrument)
	if err != nil {
		return err
	}

	if o.Quantity, err = tool.ParsePositive("quantity", in.Quantity, unit); err != nil {
		return err
	}

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

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "quantity", After: tool.TextValue(o.Quantity.Decimal())},
		tool.Change{Field: "amount", After: tool.MoneyValue(o.Amount)},
	)

	return nil
}

// appendHeldCode states the security held: the value before of the one the action gives, or the
// instrument of an action that gives none (investment proposals design, IP9).
func appendHeldCode(pv *tool.Preview, code money.Currency) {
	held := tool.TextValue(string(code))

	for i, change := range pv.Changes {
		if change.Field == "instrument" {
			pv.Changes[i].Before = held

			return
		}
	}

	pv.Changes = append(pv.Changes, tool.Change{Field: "instrument", After: held})
}
