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
	Kind          recordInvestmentKind `json:"kind" jsonschema:"operation to propose"`
	AccountID     string               `json:"account_id" jsonschema:"security account inside a brokerage, from list_accounts"`
	CashAccountID string               `json:"cash_account_id" jsonschema:"cash account of the same brokerage"`
	Date          tool.Date            `json:"date" jsonschema:"trade or payment date"`
	Quantity      string               `json:"quantity,omitzero" jsonschema:"for buy and sell: positive quantity of the security"`
	UnitPrice     string               `json:"unit_price,omitzero" jsonschema:"for buy and sell: decimal price of one unit in the cash account's currency"`
	Fees          string               `json:"fees,omitzero" jsonschema:"for buy and sell: positive fees charged"`
	Taxes         string               `json:"taxes,omitzero" jsonschema:"for buy and sell: positive taxes charged"`
	Gross         string               `json:"gross,omitzero" jsonschema:"for income: positive gross amount paid"`
	Withheld      string               `json:"withheld,omitzero" jsonschema:"for income: positive tax withheld at source"`
	IncomeType    string               `json:"income_type,omitzero" jsonschema:"for income: type from get_portfolio with view income_types"`
	CategoryID    string               `json:"category_id,omitzero" jsonschema:"for income: income category from list_accounts"`

	Description        string `json:"description,omitzero" jsonschema:"description of the transaction; the default one when absent"`
	TaxesCategoryID    string `json:"taxes_category_id,omitzero" jsonschema:"for buy and sell: expense category of the taxes; the taxes account when absent"`
	WithheldCategoryID string `json:"withheld_category_id,omitzero" jsonschema:"for income: expense category of the tax withheld; the taxes account when absent"`
}

type recordInvestmentOut struct {
	TransactionID string `json:"transaction_id"`
}

func recordInvestment(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "record_investment",
		Description: "Proposes an investment transaction in a brokerage: buy or sell a security for cash of the same brokerage at average cost, or record income paid on a security. " +
			"Use it when the user reports a trade, a dividend or other investment income. " +
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

func planInvestment(ctx context.Context, svc *app.Service, booksID int64, in recordInvestmentIn) (tool.Preview, func() (recordInvestmentOut, error), error) {
	pv := tool.Preview{Action: "record_investment"}

	ids, err := parseInvestmentIDs(in)
	if err != nil {
		return pv, nil, err
	}

	if err = checkInvestmentFields(in); err != nil {
		return pv, nil, err
	}

	security, err := svc.Account(ctx, booksID, ids.account)
	if err != nil {
		return pv, nil, err
	}

	cash, err := svc.Account(ctx, booksID, ids.cash)
	if err != nil {
		return pv, nil, err
	}

	cashUnit, err := svc.AmountOf(ctx, 0, cash.Instrument)
	if err != nil {
		return pv, nil, err
	}

	pv.Target = security.Name
	pv.Changes = []tool.Change{{Field: "instrument", After: tool.TextValue(string(security.Instrument))}}

	step := investmentStep{
		svc: svc, booksID: booksID, in: in, ids: ids, security: security, cash: cash, cashUnit: cashUnit,
	}
	if in.Kind == "income" {
		return step.income(ctx, pv)
	}

	return step.trade(ctx, pv)
}

type investmentIDs struct {
	account, cash, category, taxesCategory, withheldCategory uuid.UUID
}

func parseInvestmentIDs(in recordInvestmentIn) (investmentIDs, error) {
	var ids investmentIDs

	var err error
	if ids.account, err = requiredID(in.AccountID, "account_id"); err != nil {
		return ids, err
	}

	if ids.cash, err = requiredID(in.CashAccountID, "cash_account_id"); err != nil {
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
		"account_id": true, "cash_account_id": true, "date": !in.Date.IsZero(), "quantity": in.Quantity != "", "unit_price": in.UnitPrice != "",
		"fees": in.Fees != "", "taxes": in.Taxes != "", "gross": in.Gross != "", "withheld": in.Withheld != "", "income_type": in.IncomeType != "", "category_id": in.CategoryID != "",
		"description": in.Description != "", "taxes_category_id": in.TaxesCategoryID != "", "withheld_category_id": in.WithheldCategoryID != "",
	}

	base := []string{"account_id", "cash_account_id", "date"}
	if in.Kind == "income" {
		return checkFields(action, given, append(base, "gross", "income_type", "category_id"), "withheld", "description", "withheld_category_id")
	}

	return checkFields(action, given, append(base, "quantity", "unit_price"), "fees", "taxes", "description", "taxes_category_id")
}

// investmentStep holds the resolved inputs that the income and trade steps share.
type investmentStep struct {
	svc      *app.Service
	booksID  int64
	in       recordInvestmentIn
	ids      investmentIDs
	security domain.Account
	cash     domain.Account
	cashUnit money.Money
}

func (s investmentStep) income(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (recordInvestmentOut, error), error) {
	in := s.in

	gross, err := tool.ParsePositive("gross", in.Gross, s.cashUnit)
	if err != nil {
		return pv, nil, err
	}

	withheld, err := s.optional("withheld", in.Withheld)
	if err != nil {
		return pv, nil, err
	}

	o := domain.IncomeOrder{
		AccountID: s.security.ID, CashAccountID: s.cash.ID, CategoryID: s.ids.category, Type: domain.IncomeType(in.IncomeType),
		Date: in.Date.Time, Gross: gross, Withheld: withheld,
		WithheldCategoryID: s.ids.withheldCategory, Description: in.Description,
	}
	appendAmountChange(&pv, &gross)
	appendAmountChange(&pv, withheld)

	pv.Changes = append(pv.Changes, tool.Change{Field: "account", After: tool.TextValue(s.cash.Name)}, tool.Change{Field: "date", After: tool.DateValue(in.Date.Time)})

	return pv, func() (recordInvestmentOut, error) {
		t, err := s.svc.RecordIncome(ctx, s.booksID, o)
		return recordInvestmentOut{TransactionID: t.ID.String()}, err
	}, nil
}

func (s investmentStep) trade(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (recordInvestmentOut, error), error) {
	in := s.in

	secUnit, err := s.svc.AmountOf(ctx, 0, s.security.Instrument)
	if err != nil {
		return pv, nil, err
	}

	quantity, err := tool.ParsePositive("quantity", in.Quantity, secUnit)
	if err != nil {
		return pv, nil, err
	}

	price, err := money.ParseRate(in.UnitPrice)
	if err != nil {
		return pv, nil, tool.InvalidArgument("unit_price", "must be a positive decimal with at most 12 decimals")
	}

	fees, err := s.optional("fees", in.Fees)
	if err != nil {
		return pv, nil, err
	}

	taxes, err := s.optional("taxes", in.Taxes)
	if err != nil {
		return pv, nil, err
	}

	o := domain.TradeOrder{
		AccountID: s.security.ID, CashAccountID: s.cash.ID, Side: domain.Side(in.Kind), Date: in.Date.Time,
		Quantity: quantity, UnitPrice: price, Fees: fees, Taxes: taxes,
		TaxesCategoryID: s.ids.taxesCategory, Description: in.Description,
	}
	pv.Changes = append(pv.Changes, tool.Change{Field: "quantity", After: tool.TextValue(quantity.Decimal())}, tool.Change{Field: "price", After: tool.TextValue(price.String())})

	appendAmountChange(&pv, fees)
	appendAmountChange(&pv, taxes)

	pv.Changes = append(pv.Changes, tool.Change{Field: "account", After: tool.TextValue(s.cash.Name)}, tool.Change{Field: "date", After: tool.DateValue(in.Date.Time)})

	return pv, func() (recordInvestmentOut, error) {
		t, err := s.svc.RecordTrade(ctx, s.booksID, o)
		return recordInvestmentOut{TransactionID: t.ID.String()}, err
	}, nil
}

func (s investmentStep) optional(field, text string) (*money.Money, error) {
	if text == "" {
		return nil, nil
	}

	m, err := tool.ParsePositive(field, text, s.cashUnit)

	return &m, err
}

func appendAmountChange(pv *tool.Preview, m *money.Money) {
	if m != nil {
		pv.Changes = append(pv.Changes, tool.Change{Field: "amount", After: tool.MoneyValue(*m)})
	}
}
