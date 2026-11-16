package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type estimateRedemptionIn struct {
	AccountID string    `json:"account_id" jsonschema:"Investment line of the fixed income security, from list_accounts"`
	Date      tool.Date `json:"date"       jsonschema:"redemption or sale date"`
	Quantity  string    `json:"quantity"   jsonschema:"units redeemed or sold, a decimal in the scale of the security"`
	Proceeds  string    `json:"proceeds"   jsonschema:"gross amount received before tax, a decimal in the base currency"`
}

type estimateRedemptionOut struct {
	IncomeTax tool.Money `json:"income_tax" jsonschema:"estimated income tax withheld at source"`
	IOF       tool.Money `json:"iof"        jsonschema:"estimated IOF on a redemption within 30 days"`
	Net       tool.Money `json:"net"        jsonschema:"proceeds less income tax and IOF"`
}

func estimateRedemption(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "estimate_redemption",
		Description: "Returns the income tax and the IOF a broker withholds on the redemption or sale of a fixed income security, " +
			"estimated from the dated purchase lots that the sale consumes, oldest first. " +
			"It answers only for a security taxed at source in a Brazilian book (CDB, RDB, LC, LF, debenture, Tesouro); " +
			"LCI, LCA, CRI, CRA and stocks have no estimate. " +
			"Use it to show what a redemption nets and to fill taxes in record_investment when the user has no notice yet. " +
			"Do not use it as the figure to record when the user has the notice of the broker: the notice prevails.",
		Effect:     tool.ReadOnly,
		Idempotent: true,
	}, func(ctx context.Context, booksID int64, in estimateRedemptionIn) (estimateRedemptionOut, error) {
		return runEstimateRedemption(ctx, svc, booksID, in)
	})
}

func runEstimateRedemption(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in estimateRedemptionIn,
) (estimateRedemptionOut, error) {
	id, err := requiredID(in.AccountID, "account_id")
	if err != nil {
		return estimateRedemptionOut{}, err
	}

	quantity, proceeds, err := redemptionAmounts(ctx, svc, booksID, id, in)
	if err != nil {
		return estimateRedemptionOut{}, err
	}

	w, err := svc.EstimateWithholding(ctx, booksID, id, in.Date.Time, quantity, proceeds)
	if err != nil {
		return estimateRedemptionOut{}, err
	}

	return estimateRedemptionOut{
		IncomeTax: tool.MoneyOf(w.IncomeTax),
		IOF:       tool.MoneyOf(w.IOF),
		Net:       tool.MoneyOf(w.Net),
	}, nil
}

// redemptionAmounts reads the units in the scale of the security and the proceeds in the scale
// of the base currency, as minor units.
func redemptionAmounts(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	id uuid.UUID,
	in estimateRedemptionIn,
) (quantity, proceeds int64, err error) {
	a, err := svc.Account(ctx, booksID, id)
	if err != nil {
		return 0, 0, err
	}

	settings, err := svc.Settings(ctx, booksID)
	if err != nil {
		return 0, 0, err
	}

	unit, err := svc.AmountOf(ctx, 0, a.Instrument)
	if err != nil {
		return 0, 0, err
	}

	units, err := tool.ParsePositive("quantity", in.Quantity, unit)
	if err != nil {
		return 0, 0, err
	}

	baseUnit, err := svc.AmountOf(ctx, 0, settings.BaseCurrency)
	if err != nil {
		return 0, 0, err
	}

	gross, err := tool.ParseAmount("proceeds", in.Proceeds, baseUnit)
	if err != nil {
		return 0, 0, err
	}

	return units.Amount(), gross.Amount(), nil
}
