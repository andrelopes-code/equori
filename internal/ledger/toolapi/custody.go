package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type transferCustodyIn struct {
	AccountID   string    `json:"account_id"           jsonschema:"Investment line that gives the units, from list_accounts"`
	BrokerageID string    `json:"brokerage_id"         jsonschema:"Brokerage that receives the units, from list_accounts; not the one that holds account_id"`
	Date        tool.Date `json:"date"                 jsonschema:"date the units arrive at the receiving Brokerage"`
	Quantity    string    `json:"quantity"             jsonschema:"positive quantity of the security to move, at most the quantity held on the date"`
	Description string    `json:"description,omitzero" jsonschema:"description of the transaction; a title derived from the investment when empty"`
}

func transferCustody(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "transfer_custody",
		Description: "Proposes a custody transfer: units of one Investment move to another Brokerage with their cost, and no result is recorded. " +
			"The receiving Brokerage gets the Investment line when it has none. " +
			"Use it when the user moved a holding between brokers without selling it. " +
			"A sale of the holding recorded after the date refuses the transfer (later_sale_exists). " +
			"Do not use it for money: record_transaction with a transfer does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in transferCustodyIn) (tool.Preview, error) {
		pv, _, err := planCustodyTransfer(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in transferCustodyIn) (recordInvestmentOut, error) {
		_, o, err := planCustodyTransfer(ctx, svc, booksID, in)
		if err != nil {
			return recordInvestmentOut{}, err
		}

		t, err := svc.RecordCustodyTransfer(ctx, booksID, o)

		return recordInvestmentOut{TransactionID: t.ID.String()}, err
	})
}

func planCustodyTransfer(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in transferCustodyIn,
) (tool.Preview, domain.CustodyOrder, error) {
	pv := tool.Preview{Action: "transfer_custody"}

	holding, brokerage, err := custodyAccounts(ctx, svc, booksID, in)
	if err != nil {
		return pv, domain.CustodyOrder{}, err
	}

	unit, err := svc.AmountOf(ctx, 0, holding.Instrument)
	if err != nil {
		return pv, domain.CustodyOrder{}, err
	}

	quantity, err := tool.ParsePositive("quantity", in.Quantity, unit)
	if err != nil {
		return pv, domain.CustodyOrder{}, err
	}

	pv.Target = holding.Name
	pv.Changes = []tool.Change{
		{Field: "account", After: tool.TextValue(brokerage.Name)},
		{Field: "quantity", After: tool.TextValue(quantity.Decimal())},
		{Field: "date", After: tool.DateValue(in.Date.Time)},
	}

	return pv, domain.CustodyOrder{
		AccountID:   holding.ID,
		BrokerageID: brokerage.ID,
		Date:        in.Date.Time,
		Quantity:    quantity,
		Description: in.Description,
	}, nil
}

func custodyAccounts(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in transferCustodyIn,
) (domain.Account, domain.Account, error) {
	var holdingID, brokerageID uuid.UUID

	var err error
	if holdingID, err = optionalID(in.AccountID, "account_id"); err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	if brokerageID, err = optionalID(in.BrokerageID, "brokerage_id"); err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	holding, err := svc.Account(ctx, booksID, holdingID)
	if err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	brokerage, err := svc.Account(ctx, booksID, brokerageID)

	return holding, brokerage, err
}
