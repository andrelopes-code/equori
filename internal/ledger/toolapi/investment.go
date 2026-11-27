package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type recordInvestmentKind string

func (recordInvestmentKind) Values() []string {
	return []string{"buy", "sell", "write_off", "opening", "income"}
}

type recordInvestmentIn struct {
	Kind          recordInvestmentKind `json:"kind"                     jsonschema:"operation to propose"`
	BrokerageID   string               `json:"brokerage_id,omitzero"    jsonschema:"Brokerage that holds the Investment, from list_accounts; with instrument, instead of account_id"`
	Instrument    string               `json:"instrument,omitzero"      jsonschema:"code of the Investment, such as PETR4"`
	AccountID     string               `json:"account_id,omitzero"      jsonschema:"Investment line inside a Brokerage, from list_accounts; instead of brokerage_id and instrument"`
	CashAccountID string               `json:"cash_account_id,omitzero" jsonschema:"Cash of the Brokerage or an open account of its institution; the single candidate if absent"`
	Date          tool.Date            `json:"date"                     jsonschema:"trade or payment date"`
	Quantity      string               `json:"quantity,omitzero"        jsonschema:"buy, sell: positive quantity"`
	UnitPrice     string               `json:"unit_price,omitzero"      jsonschema:"buy, sell: price of one unit in the cash currency"`
	Fees          string               `json:"fees,omitzero"            jsonschema:"buy, sell: fees"`
	Taxes         string               `json:"taxes,omitzero"           jsonschema:"buy, sell: taxes"`
	SettledOn     tool.Date            `json:"settlement_date,omitzero" jsonschema:"buy, sell: day the cash moves; derived if empty"`
	Gross         string               `json:"gross,omitzero"           jsonschema:"income: positive gross amount paid"`
	Withheld      string               `json:"withheld,omitzero"        jsonschema:"income: tax withheld; region rate when absent"`
	IncomeType    string               `json:"income_type,omitzero"     jsonschema:"income: type from get_portfolio with view income_types"`
	CategoryID    string               `json:"category_id,omitzero"     jsonschema:"income: income category from list_accounts"`

	Description        string `json:"description,omitzero"          jsonschema:"description of the transaction; derived from the kind and the investment if empty"`
	TaxesCategoryID    string `json:"taxes_category_id,omitzero"    jsonschema:"buy, sell: expense category of the taxes; the taxes account if absent"`
	WithheldCategoryID string `json:"withheld_category_id,omitzero" jsonschema:"income: expense category of the tax withheld; the taxes account if absent"`

	TransactionID string `json:"transaction_id,omitzero" jsonschema:"trade or income to correct, from get_transactions; the proposal replaces the whole order: repeat the fields that stay"`
	Reason        string `json:"reason,omitzero"         jsonschema:"with transaction_id: why the transaction changes, kept in its history"`
}

type recordInvestmentOut struct {
	TransactionID string `json:"transaction_id"`
}

func recordInvestment(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "record_investment",
		Description: "Proposes an investment transaction in a Brokerage: buy or sell an Investment for its Cash, or record income paid on an Investment. " +
			"A first buy creates the Investment line; a sale or income needs one. " +
			"A Brokerage with no Cash in the base currency is refused: create one with manage_accounts_and_payees. " +
			"write_off removes units at zero proceeds, their cost a realized loss: an expired option, an unexercised right, a worthless security. " +
			"opening records units held before the book at their cost on the date acquired, no cash: quantity, unit_price, fees. " +
			"Use it for a trade, a dividend or other income. " +
			"With transaction_id and reason it corrects that trade or income instead of recording one; change_transaction does not. " +
			"Do not use it to define a new security: manage_instrument does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in recordInvestmentIn) (tool.Preview, error) {
		pv, _, err := planInvestment(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in recordInvestmentIn) (recordInvestmentOut, error) {
		_, run, err := planInvestment(ctx, svc, booksID, in)
		if err != nil {
			return recordInvestmentOut{}, err
		}

		return run()
	})
}

func planInvestment(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordInvestmentIn,
) (tool.Preview, func() (recordInvestmentOut, error), error) {
	pv := tool.Preview{Action: "record_investment." + string(in.Kind)}

	ids, err := parseInvestmentIDs(in)
	if err != nil {
		return pv, nil, err
	}

	if err = checkInvestmentFields(in); err != nil {
		return pv, nil, err
	}

	target, err := resolveInvestmentTarget(ctx, svc, booksID, in, ids)
	if err != nil {
		return pv, nil, err
	}

	fix, err := loadCorrection(ctx, svc, booksID, in)
	if err != nil {
		return pv, nil, err
	}

	pv.Target = target.name
	pv.Changes = []tool.Change{
		{Field: "instrument", After: tool.TextValue(string(target.instrument))},
	}
	fix.describe(&pv, in.Kind)

	step := investmentStep{svc: svc, booksID: booksID, in: in, ids: ids, target: target, fix: fix}
	if in.Kind == "income" {
		return step.income(ctx, pv)
	}

	return step.trade(ctx, pv)
}

// investmentStep holds the resolved inputs that the income and trade steps share.
type investmentStep struct {
	svc     *app.Service
	booksID int64
	in      recordInvestmentIn
	ids     investmentIDs
	target  investmentTarget
	fix     correction
}

func (s investmentStep) income(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (recordInvestmentOut, error), error) {
	in := s.in

	gross, err := tool.ParsePositive("gross", in.Gross, s.target.cashUnit)
	if err != nil {
		return pv, nil, err
	}

	withheld, err := s.withheld(ctx, gross)
	if err != nil {
		return pv, nil, err
	}

	o := domain.IncomeOrder{
		AccountID:          s.ids.account,
		CashAccountID:      s.ids.cash,
		BrokerageID:        s.ids.brokerage,
		Instrument:         money.Currency(in.Instrument),
		CategoryID:         s.ids.category,
		Type:               domain.IncomeType(in.IncomeType),
		Date:               in.Date.Time,
		Gross:              gross,
		Withheld:           withheld,
		WithheldCategoryID: s.ids.withheldCategory,
		Description:        in.Description,
	}

	net, err := subtract(gross, withheld)
	if err != nil {
		return pv, nil, err
	}

	appendMoneyChange(&pv, "amount", &gross)
	appendMoneyChange(&pv, "withheld", withheld)
	appendMoneyChange(&pv, "net", &net)
	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "income_type", After: tool.TextValue(in.IncomeType)},
	)

	s.appendCashAndDate(&pv)
	s.fix.compareIncome(&pv)

	return pv, func() (recordInvestmentOut, error) {
		t, err := s.fix.income(s.svc)(ctx, s.booksID, o)
		return recordInvestmentOut{TransactionID: t.ID.String()}, err
	}, nil
}

// withheld is the tax the proposal states and records: the one given, zero included, or the one
// the region's rate takes; nil when neither exists.
func (s investmentStep) withheld(ctx context.Context, gross money.Money) (*money.Money, error) {
	in := s.in

	if in.Withheld != "" {
		given, err := tool.ParseAmount("withheld", in.Withheld, s.target.cashUnit)
		if err != nil {
			return nil, err
		}

		if given.IsNegative() {
			return nil, tool.InvalidArgument("withheld", "must be zero or greater")
		}

		return &given, nil
	}

	estimate, err := s.svc.EstimateIncomeWithholding(
		ctx,
		s.booksID,
		domain.IncomeType(in.IncomeType),
		in.Date.Time,
		gross.Amount(),
	)
	if err != nil || estimate.RateBP == 0 {
		return nil, err
	}

	return &estimate.Withheld, nil
}

func (s investmentStep) trade(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (recordInvestmentOut, error), error) {
	o, err := s.tradeOrder(ctx)
	if err != nil {
		return pv, nil, err
	}

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "quantity", After: tool.TextValue(o.Quantity.Decimal())},
	)
	if o.Side != domain.SideWriteOff {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "price", After: tool.TextValue(o.UnitPrice.String())},
		)
	}

	appendMoneyChange(&pv, "fees", o.Fees)
	appendMoneyChange(&pv, "taxes", o.Taxes)

	if err = appendTradeMoney(&pv, o, s.target.cashUnit.Currency()); err != nil {
		return pv, nil, err
	}

	s.appendCashAndDate(&pv)

	if err = s.appendSettlement(ctx, &pv, o); err != nil {
		return pv, nil, err
	}

	s.fix.compareTrade(&pv)

	return pv, func() (recordInvestmentOut, error) {
		t, err := s.fix.trade(s.svc)(ctx, s.booksID, o)
		return recordInvestmentOut{TransactionID: t.ID.String()}, err
	}, nil
}

func (s investmentStep) tradeOrder(ctx context.Context) (domain.TradeOrder, error) {
	in := s.in

	secUnit, err := s.svc.AmountOf(ctx, 0, s.target.instrument)
	if err != nil {
		return domain.TradeOrder{}, err
	}

	quantity, err := tool.ParsePositive("quantity", in.Quantity, secUnit)
	if err != nil {
		return domain.TradeOrder{}, err
	}

	price, err := s.unitPrice()
	if err != nil {
		return domain.TradeOrder{}, err
	}

	fees, err := s.optional("fees", in.Fees)
	if err != nil {
		return domain.TradeOrder{}, err
	}

	taxes, err := s.optional("taxes", in.Taxes)
	if err != nil {
		return domain.TradeOrder{}, err
	}

	o := domain.TradeOrder{
		AccountID:       s.ids.account,
		CashAccountID:   s.ids.cash,
		BrokerageID:     s.ids.brokerage,
		Instrument:      money.Currency(in.Instrument),
		Side:            domain.Side(in.Kind),
		Date:            in.Date.Time,
		Quantity:        quantity,
		UnitPrice:       price,
		Fees:            fees,
		Taxes:           taxes,
		TaxesCategoryID: s.ids.taxesCategory,
		Description:     in.Description,
	}
	if !in.SettledOn.IsZero() {
		o.SettlementDate = &in.SettledOn.Time
	}

	return o, nil
}

// unitPrice parses the price of the order. A write-off takes no price (listed options design
// W1).
func (s investmentStep) unitPrice() (money.Rate, error) {
	if s.in.Kind == "write_off" {
		return money.Rate{}, nil
	}

	price, err := money.ParseRate(s.in.UnitPrice)
	if err != nil {
		return price, tool.InvalidArgument(
			"unit_price",
			"must be a positive decimal with at most 12 decimals",
		)
	}

	return price, nil
}

func (s investmentStep) appendCashAndDate(pv *tool.Preview) {
	if s.target.cashName != "" {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "account", After: tool.TextValue(s.target.cashName)},
		)
	}

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "date", After: tool.DateValue(s.in.Date.Time)},
	)
}

func (s investmentStep) optional(field, text string) (*money.Money, error) {
	if text == "" {
		return nil, nil
	}

	m, err := tool.ParsePositive(field, text, s.target.cashUnit)

	return &m, err
}

// appendSettlement states the day the cash of o moves; a write-off moves none.
func (s investmentStep) appendSettlement(
	ctx context.Context,
	pv *tool.Preview,
	o domain.TradeOrder,
) error {
	if o.Side == domain.SideWriteOff || o.Side == domain.SideOpening {
		return nil
	}

	settled, err := s.svc.SettlementDate(ctx, s.target.instrument, o.Date, o.SettlementDate)
	if err != nil {
		return err
	}

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "settlement", After: tool.DateValue(settled)},
	)

	return nil
}

// appendTradeMoney adds the gross (quantity × price) as amount and the signed change of the cash as
// net (investment proposals design, IP1). A write-off has neither; an opening has no net.
func appendTradeMoney(pv *tool.Preview, o domain.TradeOrder, cash money.Currency) error {
	if o.Side == domain.SideWriteOff {
		return nil
	}

	gross, err := grossOf(o.Quantity, o.UnitPrice, cash)
	if err != nil {
		return err
	}

	if o.Side == domain.SideOpening {
		appendMoneyChange(pv, "amount", &gross)

		return nil
	}

	signed := gross
	if o.Side == domain.SideBuy {
		signed = gross.Neg()
	}

	net, err := subtract(signed, o.Fees, o.Taxes)
	if err != nil {
		return err
	}

	appendMoneyChange(pv, "amount", &gross)
	appendMoneyChange(pv, "net", &net)

	return nil
}
