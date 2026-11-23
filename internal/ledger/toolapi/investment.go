package toolapi

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type recordInvestmentKind string

func (recordInvestmentKind) Values() []string {
	return []string{"buy", "sell", "write_off", "income"}
}

type recordInvestmentIn struct {
	Kind          recordInvestmentKind `json:"kind"                     jsonschema:"operation to propose"`
	BrokerageID   string               `json:"brokerage_id,omitzero"    jsonschema:"Brokerage that holds the Investment, from list_accounts; with instrument, instead of account_id"`
	Instrument    string               `json:"instrument,omitzero"      jsonschema:"code of the Investment, such as PETR4"`
	AccountID     string               `json:"account_id,omitzero"      jsonschema:"Investment line inside a Brokerage, from list_accounts; instead of brokerage_id and instrument"`
	CashAccountID string               `json:"cash_account_id,omitzero" jsonschema:"Cash of the Brokerage or an open account of its institution; the single candidate when absent"`
	Date          tool.Date            `json:"date"                     jsonschema:"trade or payment date"`
	Quantity      string               `json:"quantity,omitzero"        jsonschema:"for buy and sell: positive quantity of the security"`
	UnitPrice     string               `json:"unit_price,omitzero"      jsonschema:"for buy and sell: decimal price of one unit in the cash account's currency"`
	Fees          string               `json:"fees,omitzero"            jsonschema:"for buy and sell: positive fees charged"`
	Taxes         string               `json:"taxes,omitzero"           jsonschema:"for buy and sell: positive taxes charged"`
	Gross         string               `json:"gross,omitzero"           jsonschema:"for income: positive gross amount paid"`
	Withheld      string               `json:"withheld,omitzero"        jsonschema:"for income: positive tax withheld at source"`
	IncomeType    string               `json:"income_type,omitzero"     jsonschema:"for income: type from get_portfolio with view income_types"`
	CategoryID    string               `json:"category_id,omitzero"     jsonschema:"for income: income category from list_accounts"`

	Description        string `json:"description,omitzero"          jsonschema:"description of the transaction; a title derived from the kind and the investment when empty"`
	TaxesCategoryID    string `json:"taxes_category_id,omitzero"    jsonschema:"for buy and sell: expense category of the taxes; the taxes account when absent"`
	WithheldCategoryID string `json:"withheld_category_id,omitzero" jsonschema:"for income: expense category of the tax withheld; the taxes account when absent"`

	TransactionID string `json:"transaction_id,omitzero" jsonschema:"trade or income to correct, from get_transactions; the proposal replaces the whole order: repeat every field that stays"`
	Reason        string `json:"reason,omitzero"         jsonschema:"with transaction_id: why the transaction changes, kept in its history"`
}

type recordInvestmentOut struct {
	TransactionID string `json:"transaction_id"`
}

func recordInvestment(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "record_investment",
		Description: "Proposes an investment transaction in a Brokerage: buy or sell an Investment for the Cash of the same Brokerage, or record income paid on an Investment. " +
			"A first buy creates the Investment line; a sale or income needs an existing one. " +
			"A Brokerage with no Cash account in the base currency is refused: create one first with manage_accounts_and_payees. " +
			"Use it when the user reports a trade, a dividend or other investment income. " +
			"write_off removes units at zero proceeds, their cost a realized loss: an option expired, a right not exercised, a security that became worthless. " +
			"With transaction_id and reason it corrects that trade or income instead of recording one: change_transaction does not correct them. " +
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
	fix.describe(&pv)

	step := investmentStep{svc: svc, booksID: booksID, in: in, ids: ids, target: target, fix: fix}
	if in.Kind == "income" {
		return step.income(ctx, pv)
	}

	return step.trade(ctx, pv)
}

type investmentIDs struct {
	account, brokerage, cash, category, taxesCategory, withheldCategory uuid.UUID
}

func parseInvestmentIDs(in recordInvestmentIn) (investmentIDs, error) {
	var ids investmentIDs

	var err error
	if ids.account, err = optionalID(in.AccountID, "account_id"); err != nil {
		return ids, err
	}

	if ids.brokerage, err = optionalID(in.BrokerageID, "brokerage_id"); err != nil {
		return ids, err
	}

	if ids.cash, err = optionalID(in.CashAccountID, "cash_account_id"); err != nil {
		return ids, err
	}

	if ids.category, err = optionalID(in.CategoryID, "category_id"); err != nil {
		return ids, err
	}

	if ids.taxesCategory, err = optionalID(in.TaxesCategoryID, "taxes_category_id"); err != nil {
		return ids, err
	}

	ids.withheldCategory, err = optionalID(in.WithheldCategoryID, "withheld_category_id")

	return ids, err
}

func checkInvestmentFields(in recordInvestmentIn) error {
	action := string(in.Kind)
	given := map[string]bool{
		"account_id":           in.AccountID != "",
		"brokerage_id":         in.BrokerageID != "",
		"instrument":           in.Instrument != "",
		"cash_account_id":      in.CashAccountID != "",
		"date":                 !in.Date.IsZero(),
		"quantity":             in.Quantity != "",
		"unit_price":           in.UnitPrice != "",
		"fees":                 in.Fees != "",
		"taxes":                in.Taxes != "",
		"gross":                in.Gross != "",
		"withheld":             in.Withheld != "",
		"income_type":          in.IncomeType != "",
		"category_id":          in.CategoryID != "",
		"description":          in.Description != "",
		"taxes_category_id":    in.TaxesCategoryID != "",
		"withheld_category_id": in.WithheldCategoryID != "",
	}
	// transaction_id and reason serve every kind; loadCorrection checks them.
	target := []string{"account_id", "brokerage_id", "instrument", "cash_account_id"}

	if in.Kind == "income" {
		return checkFields(action, given, []string{"date", "gross", "income_type", "category_id"},
			append(target, "withheld", "description", "withheld_category_id")...)
	}

	if in.Kind == "write_off" {
		return checkFields(action, given, []string{"date", "quantity"},
			"account_id", "brokerage_id", "instrument", "description")
	}

	return checkFields(action, given, []string{"date", "quantity", "unit_price"},
		append(target, "fees", "taxes", "description", "taxes_category_id")...)
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

	withheld, err := s.optional("withheld", in.Withheld)
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
	appendMoneyChange(&pv, "amount", &gross)
	appendMoneyChange(&pv, "withheld", withheld)

	s.appendCashAndDate(&pv)

	return pv, func() (recordInvestmentOut, error) {
		t, err := s.fix.income(s.svc)(ctx, s.booksID, o)
		return recordInvestmentOut{TransactionID: t.ID.String()}, err
	}, nil
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

	if err = appendGross(&pv, o, s.target.cashUnit.Currency()); err != nil {
		return pv, nil, err
	}

	s.appendCashAndDate(&pv)

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

	// A write-off takes no price (listed options design W1).
	var price money.Rate
	if in.Kind != "write_off" {
		if price, err = money.ParseRate(in.UnitPrice); err != nil {
			return domain.TradeOrder{}, tool.InvalidArgument(
				"unit_price",
				"must be a positive decimal with at most 12 decimals",
			)
		}
	}

	fees, err := s.optional("fees", in.Fees)
	if err != nil {
		return domain.TradeOrder{}, err
	}

	taxes, err := s.optional("taxes", in.Taxes)
	if err != nil {
		return domain.TradeOrder{}, err
	}

	return domain.TradeOrder{
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
	}, nil
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

// appendGross adds quantity × price as amount: the card draws that equation (assistant
// conversation design, section 7). A write-off has no price.
func appendGross(pv *tool.Preview, o domain.TradeOrder, cash money.Currency) error {
	if o.Side == domain.SideWriteOff {
		return nil
	}

	gross, err := money.Convert(o.Quantity, cash, money.Leg{Rate: o.UnitPrice})
	if err != nil {
		return fmt.Errorf("convert gross amount: %w", err)
	}

	appendMoneyChange(pv, "amount", &gross)

	return nil
}

func appendMoneyChange(pv *tool.Preview, field string, m *money.Money) {
	if m != nil {
		pv.Changes = append(pv.Changes, tool.Change{Field: field, After: tool.MoneyValue(*m)})
	}
}
