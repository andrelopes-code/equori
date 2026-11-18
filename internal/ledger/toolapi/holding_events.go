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

type corporateActionKind string

func (corporateActionKind) Values() []string {
	return []string{
		"split", "reverse_split", "bonus", "unit_tax", "conversion", "spin_off", "right_issue",
		"right_exercise", "capital_return",
	}
}

type recordCorporateActionIn struct {
	Kind          corporateActionKind `json:"kind"                     jsonschema:"split: more units for each one held; reverse_split: fewer units; bonus: units received for free; unit_tax: units of a fund cancelled for income tax; conversion: the holding becomes new_instrument (merger, ticker change); spin_off: units of new_instrument beside the holding; right_issue: subscription rights new_instrument beside the holding, at no cost; right_exercise: the rights become new_instrument (share or receipt) for amount; capital_return: amount paid back lowers the cost"`
	AccountID     string              `json:"account_id,omitzero"      jsonschema:"Investment line, from list_accounts; instead of brokerage_id and instrument"`
	BrokerageID   string              `json:"brokerage_id,omitzero"    jsonschema:"Brokerage that holds the Investment; with instrument, instead of account_id"`
	Instrument    string              `json:"instrument,omitzero"      jsonschema:"code of the Investment, such as PETR4"`
	Date          tool.Date           `json:"date"                     jsonschema:"first day without the right; for unit_tax, the day the units were cancelled"`
	RatioFrom     int64               `json:"ratio_from,omitzero"      jsonschema:"split, reverse_split and bonus: units held, the For each of the notice, from 1 to 1000000"`
	RatioTo       int64               `json:"ratio_to,omitzero"        jsonschema:"split, reverse_split and bonus: units received for each ratio_from held; a split of 1 into 10 is ratio_from 1 and ratio_to 10, a reverse split of 10 into 1 is 10 and 1, a bonus of 1 for each 10 is 10 and 1"`
	UnitCost      string              `json:"unit_cost,omitzero"       jsonschema:"bonus: cost per unit received that the company states, added to the cost of the holding and recorded as exempt income"`
	CategoryID    string              `json:"category_id,omitzero"     jsonschema:"bonus with unit_cost: income category, from list_accounts"`
	Quantity      string              `json:"quantity,omitzero"        jsonschema:"unit_tax: positive quantity of units cancelled, below the units held"`
	Amount        string              `json:"amount,omitzero"          jsonschema:"unit_tax: income tax withheld; right_exercise: subscription price paid in total; in the base currency"`
	CashAccountID string              `json:"cash_account_id,omitzero" jsonschema:"right_exercise: account that pays amount, from list_accounts; the cash account of the brokerage when empty"`
	Description   string              `json:"description,omitzero"     jsonschema:"description of the transaction; a title derived from the kind and the investment when empty"`
	NewInstrument string              `json:"new_instrument,omitzero"  jsonschema:"conversion and spin_off: code of the security received"`
	CostPercent   string              `json:"cost_percent,omitzero"    jsonschema:"spin_off: percent of the cost moved to new_instrument, as the company's notice states"`
}

func recordCorporateAction(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "record_corporate_action",
		Description: "Proposes a corporate action on one Investment: a split, a reverse split, a bonus of units or the units a fund cancels for income tax (unit_tax). " +
			"The quantity changes and the cost of the holding stays; a bonus with unit_cost adds that cost and records an exempt income. " +
			"A conversion moves the whole cost to new_instrument; a spin_off moves cost_percent of it. " +
			"A right is sold with record_investment sell. " +
			"A fraction of a unit leaves the position; its auction cash is recorded with record_investment kind income when it arrives. " +
			"Use it when the user reports one of these events on a holding. " +
			"An action is not corrected: void_transaction removes it and it is recorded again. " +
			"Do not use it for a dividend or other cash income: record_investment does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in recordCorporateActionIn) (tool.Preview, error) {
		pv, _, err := planCorporateAction(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in recordCorporateActionIn) (recordInvestmentOut, error) {
		_, o, err := planCorporateAction(ctx, svc, booksID, in)
		if err != nil {
			return recordInvestmentOut{}, err
		}

		t, err := svc.RecordCorporateAction(ctx, booksID, o)

		return recordInvestmentOut{TransactionID: t.ID.String()}, err
	})
}

func planCorporateAction(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordCorporateActionIn,
) (tool.Preview, domain.ActionOrder, error) {
	pv := tool.Preview{Action: "record_corporate_action." + string(in.Kind)}

	if err := checkCorporateActionFields(in); err != nil {
		return pv, domain.ActionOrder{}, err
	}

	o, holding, err := corporateActionTarget(ctx, svc, booksID, in)
	if err != nil {
		return pv, o, err
	}

	o.Kind = domain.ActionKind(in.Kind)
	o.Date = in.Date.Time
	o.Description = in.Description
	pv.Target = holding.name

	switch {
	case in.Kind == "unit_tax":
		err = planUnitTax(ctx, svc, booksID, in, holding.instrument, &o, &pv)
	case in.Kind == "capital_return":
		o.RatioFrom, o.RatioTo = 1, 1
		err = planRightPrice(ctx, svc, booksID, in, &o, &pv)
	case in.NewInstrument != "":
		err = planExchange(ctx, svc, booksID, in, &o, &pv)
	default:
		err = planRatio(in, &o, &pv)
	}

	pv.Changes = append(pv.Changes, tool.Change{Field: "date", After: tool.DateValue(o.Date)})

	return pv, o, err
}

func checkCorporateActionFields(in recordCorporateActionIn) error {
	given := actionFieldsGiven(in)
	target := []string{"account_id", "brokerage_id", "instrument", "description"}

	if in.Kind == "unit_tax" {
		return checkFields("unit_tax", given, []string{"date", "quantity", "amount"}, target...)
	}

	exchange := []string{"date", "ratio_from", "ratio_to", "new_instrument"}

	switch in.Kind {
	case "conversion", "right_issue":
		return checkFields(string(in.Kind), given, exchange, target...)
	case "right_exercise":
		return checkFields(
			"right_exercise",
			given,
			append(exchange, "amount"),
			append(target, "cash_account_id")...,
		)
	case "capital_return":
		return checkFields(
			"capital_return",
			given,
			[]string{"date", "amount"},
			append(target, "cash_account_id")...,
		)
	case "spin_off":
		return checkFields(
			"spin_off",
			given,
			[]string{"date", "ratio_from", "ratio_to", "new_instrument", "cost_percent"},
			target...,
		)
	}

	return checkFields(string(in.Kind), given, []string{"date", "ratio_from", "ratio_to"},
		append(target, "unit_cost", "category_id")...)
}

// actionFieldsGiven reports which optional fields of the call carry a value.
func actionFieldsGiven(in recordCorporateActionIn) map[string]bool {
	return map[string]bool{
		"account_id":     in.AccountID != "",
		"brokerage_id":   in.BrokerageID != "",
		"instrument":     in.Instrument != "",
		"date":           !in.Date.IsZero(),
		"ratio_from":     in.RatioFrom != 0,
		"ratio_to":       in.RatioTo != 0,
		"unit_cost":      in.UnitCost != "",
		"category_id":    in.CategoryID != "",
		"quantity":       in.Quantity != "",
		"amount":         in.Amount != "",
		"description":    in.Description != "",
		"new_instrument": in.NewInstrument != "",
		"cost_percent":   in.CostPercent != "",

		"cash_account_id": in.CashAccountID != "",
	}
}

// corporateActionHolding is the name shown for the holding and the instrument its units count.
type corporateActionHolding struct {
	name       string
	instrument money.Currency
}

// corporateActionTarget fills the holding of the order in either form of BC6 and names it.
func corporateActionTarget(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordCorporateActionIn,
) (domain.ActionOrder, corporateActionHolding, error) {
	var o domain.ActionOrder

	var h corporateActionHolding

	var err error
	if o.AccountID, err = optionalID(in.AccountID, "account_id"); err != nil {
		return o, h, err
	}

	if o.BrokerageID, err = optionalID(in.BrokerageID, "brokerage_id"); err != nil {
		return o, h, err
	}

	if o.CategoryID, err = optionalID(in.CategoryID, "category_id"); err != nil {
		return o, h, err
	}

	pair := o.BrokerageID != uuid.Nil && in.Instrument != ""
	if (o.AccountID != uuid.Nil) == pair {
		return o, h, app.ErrTradeTargetRequired
	}

	named := o.AccountID
	if pair {
		named = o.BrokerageID

		if o.Instrument, err = svc.ResolveCode(ctx, money.Currency(in.Instrument)); err != nil {
			return o, h, err
		}
	}

	account, err := svc.Account(ctx, booksID, named)
	if err != nil {
		return o, h, err
	}

	h.name, h.instrument = account.Name, o.Instrument
	if !pair {
		h.instrument = account.Instrument
	}

	return o, h, nil
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
