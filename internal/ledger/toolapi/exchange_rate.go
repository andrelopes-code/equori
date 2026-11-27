package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// parseExchangeRate reads the optional exchange_rate of a proposal; nil when empty.
func parseExchangeRate(text string) (*money.Rate, error) {
	if text == "" {
		return nil, nil
	}

	rate, err := money.ParseRate(text)
	if err != nil {
		return nil, tool.InvalidArgument(
			"exchange_rate",
			"must be a positive decimal with at most 12 decimals",
		)
	}

	return &rate, nil
}

// appendRateChanges adds the rate typed and the base amount, the cost or proceeds of net at that
// rate. Nothing is added without a rate: the rate of the day is chosen when the order is recorded.
func appendRateChanges(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	pv *tool.Preview,
	text string,
	rate *money.Rate,
	net money.Money,
) error {
	if rate == nil || net.Currency() == "" {
		return nil
	}

	settings, err := svc.Settings(ctx, booksID)
	if err != nil {
		return err
	}

	if net.IsNegative() {
		net = net.Neg()
	}

	base, err := money.Convert(net, settings.BaseCurrency, money.Leg{Rate: *rate})
	if err != nil {
		return tool.InvalidArgument("exchange_rate", "does not convert the amount: "+err.Error())
	}

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "exchange_rate", After: tool.TextValue(text)},
		tool.Change{Field: "base_amount", After: tool.MoneyValue(base)},
	)

	return nil
}
