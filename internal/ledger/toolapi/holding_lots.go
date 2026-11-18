package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getHoldingLotsIn struct {
	AccountID string    `json:"account_id"    jsonschema:"Investment line inside a Brokerage, from list_accounts"`
	Date      tool.Date `json:"date,omitzero" jsonschema:"day whose end the answer describes; today when empty"`
}

type holdingLot struct {
	AcquiredOn tool.Date  `json:"acquired_on"`
	Quantity   string     `json:"quantity"`
	Cost       tool.Money `json:"cost"`
}

type getHoldingLotsOut struct {
	Method               string       `json:"method"                jsonschema:"how a sale removes cost: fifo takes the oldest lot first, average takes the average cost of the holding"`
	EstimatesWithholding bool         `json:"estimates_withholding" jsonschema:"true when estimate_redemption answers for this holding"`
	Quantity             string       `json:"quantity"`
	CostBasis            tool.Money   `json:"cost_basis"`
	Lots                 []holdingLot `json:"lots"                  jsonschema:"open purchases, oldest first; empty under the average method"`
}

func getHoldingLots(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_holding_lots",
		Description: "Returns how one Investment removes cost on a sale, its quantity and cost basis, and each open purchase with its date, quantity and cost. " +
			"Use it to explain the cost or the tax of a sale, or which purchases a redemption consumes. " +
			"Do not use it for the value or the result of a position: get_portfolio does.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, booksID int64, in getHoldingLotsIn) (getHoldingLotsOut, error) {
		id, err := optionalID(in.AccountID, "account_id")
		if err != nil {
			return getHoldingLotsOut{}, err
		}

		date := in.Date.Time
		if date.IsZero() {
			date = svc.Today(ctx)
		}

		h, err := svc.OpenLots(ctx, booksID, id, date, uuid.Nil)
		if err != nil {
			return getHoldingLotsOut{}, err
		}

		out := getHoldingLotsOut{
			Method:               h.Method,
			EstimatesWithholding: h.EstimatesWithholding,
			Quantity:             h.Quantity.Decimal(),
			CostBasis:            tool.MoneyOf(h.CostBasis),
			Lots:                 make([]holdingLot, len(h.Lots)),
		}
		for i, l := range h.Lots {
			out.Lots[i] = holdingLot{
				AcquiredOn: tool.DateOf(l.AcquiredOn),
				Quantity:   l.Quantity.Decimal(),
				Cost:       tool.MoneyOf(l.Cost),
			}
		}

		return out, nil
	})
}
