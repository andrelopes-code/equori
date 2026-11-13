package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type recordInvestmentKind string

func (recordInvestmentKind) Values() []string { return []string{"buy", "sell", "income"} }

type recordInvestmentIn struct {
	Kind          recordInvestmentKind `json:"kind"                     jsonschema:"operation to propose"`
	BrokerageID   string               `json:"brokerage_id,omitzero"    jsonschema:"Brokerage that holds the Investment, from list_accounts; with instrument, instead of account_id"`
	Instrument    string               `json:"instrument,omitzero"      jsonschema:"code of the Investment, such as PETR4; its line in the Brokerage is created by the first buy"`
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

	Description        string `json:"description,omitzero"          jsonschema:"description of the transaction; an empty description is shown as a title derived from the kind and the investment"`
	TaxesCategoryID    string `json:"taxes_category_id,omitzero"    jsonschema:"for buy and sell: expense category of the taxes; the taxes account when absent"`
	WithheldCategoryID string `json:"withheld_category_id,omitzero" jsonschema:"for income: expense category of the tax withheld; the taxes account when absent"`

	TransactionID string `json:"transaction_id,omitzero" jsonschema:"trade or income to correct, from get_transactions; the proposal replaces its whole order, so repeat every field that stays"`
	Reason        string `json:"reason,omitzero"         jsonschema:"with transaction_id: why the transaction changes, kept in its history"`
}

type recordInvestmentOut struct {
	TransactionID string `json:"transaction_id"`
}

func recordInvestment(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "record_investment",
		Description: "Proposes an investment transaction in a Brokerage: buy or sell an Investment for the Cash of the same Brokerage at average cost, or record income paid on an Investment. " +
			"Name the Investment by brokerage_id and instrument, or by account_id. " +
			"A first buy creates the Investment line; a sale or income needs an existing one. " +
			"A Brokerage without a Cash account in the base currency is refused: create a Cash account in it first with manage_accounts_and_payees. " +
			"Use it when the user reports a trade, a dividend or other investment income. " +
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
	pv := tool.Preview{Action: "record_investment"}

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

	return checkFields(action, given, []string{"date", "quantity", "unit_price"},
		append(target, "fees", "taxes", "description", "taxes_category_id")...)
}

// investmentTarget is the Investment and the Cash of an order, in either form of BC6.
type investmentTarget struct {
	name       string
	instrument money.Currency
	cashUnit   money.Money
	cashName   string
}

// resolveInvestmentTarget names the account form or the pair form; the service resolves the
// Investment line and the default Cash at run time.
func resolveInvestmentTarget(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordInvestmentIn,
	ids investmentIDs,
) (investmentTarget, error) {
	pair := ids.brokerage != uuid.Nil && in.Instrument != ""
	if (ids.account != uuid.Nil) == pair ||
		(!pair && (ids.brokerage != uuid.Nil || in.Instrument != "")) {
		return investmentTarget{}, app.ErrTradeTargetRequired
	}

	var t investmentTarget

	if pair {
		brokerage, err := svc.Account(ctx, booksID, ids.brokerage)
		if err != nil {
			return t, err
		}

		t.name, t.instrument = brokerage.Name, money.Currency(in.Instrument)
	} else {
		security, err := svc.Account(ctx, booksID, ids.account)
		if err != nil {
			return t, err
		}

		t.name, t.instrument = security.Name, security.Instrument
	}

	unit := money.Currency("")

	if ids.cash != uuid.Nil {
		cash, err := svc.Account(ctx, booksID, ids.cash)
		if err != nil {
			return t, err
		}

		unit, t.cashName = cash.Instrument, cash.Name
	} else {
		settings, err := svc.Settings(ctx, booksID)
		if err != nil {
			return t, err
		}

		unit = settings.BaseCurrency
	}

	var err error

	t.cashUnit, err = svc.AmountOf(ctx, 0, unit)

	return t, err
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
	appendAmountChange(&pv, &gross)
	appendAmountChange(&pv, withheld)

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
		tool.Change{Field: "price", After: tool.TextValue(o.UnitPrice.String())},
	)

	appendAmountChange(&pv, o.Fees)
	appendAmountChange(&pv, o.Taxes)

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

	price, err := money.ParseRate(in.UnitPrice)
	if err != nil {
		return domain.TradeOrder{}, tool.InvalidArgument(
			"unit_price",
			"must be a positive decimal with at most 12 decimals",
		)
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

func appendAmountChange(pv *tool.Preview, m *money.Money) {
	if m != nil {
		pv.Changes = append(pv.Changes, tool.Change{Field: "amount", After: tool.MoneyValue(*m)})
	}
}
