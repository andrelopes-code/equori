package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
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
	}, func(ctx context.Context, userID int64, in recordInvestmentIn) (tool.Preview, error) {
		pv, _, err := planInvestment(ctx, svc, userID, in)
		return pv, err
	}, func(ctx context.Context, userID int64, in recordInvestmentIn) (recordInvestmentOut, error) {
		_, run, err := planInvestment(ctx, svc, userID, in)
		if err != nil {
			return recordInvestmentOut{}, err
		}
		return run()
	})
}

func planInvestment(ctx context.Context, svc *app.Service, userID int64, in recordInvestmentIn) (tool.Preview, func() (recordInvestmentOut, error), error) {
	action := string(in.Kind)
	pv := tool.Preview{Action: "record_investment"}
	accountID, err := requiredID(in.AccountID, "account_id")
	if err != nil {
		return pv, nil, err
	}
	cashID, err := requiredID(in.CashAccountID, "cash_account_id")
	if err != nil {
		return pv, nil, err
	}
	categoryID, err := optionalID(in.CategoryID, "category_id")
	if err != nil {
		return pv, nil, err
	}
	given := map[string]bool{
		"account_id": true, "cash_account_id": true, "date": !in.Date.IsZero(), "quantity": in.Quantity != "", "unit_price": in.UnitPrice != "",
		"fees": in.Fees != "", "taxes": in.Taxes != "", "gross": in.Gross != "", "withheld": in.Withheld != "", "income_type": in.IncomeType != "", "category_id": in.CategoryID != "",
	}
	base := []string{"account_id", "cash_account_id", "date"}
	if in.Kind == "income" {
		err = checkFields(action, given, append(base, "gross", "income_type", "category_id"), "withheld")
	} else {
		err = checkFields(action, given, append(base, "quantity", "unit_price"), "fees", "taxes")
	}
	if err != nil {
		return pv, nil, err
	}
	security, err := svc.Account(ctx, userID, accountID)
	if err != nil {
		return pv, nil, err
	}
	cash, err := svc.Account(ctx, userID, cashID)
	if err != nil {
		return pv, nil, err
	}
	cashUnit, err := svc.AmountOf(ctx, 0, cash.Instrument)
	if err != nil {
		return pv, nil, err
	}
	optional := func(field, s string) (*money.Money, error) {
		if s == "" {
			return nil, nil
		}
		m, err := tool.ParsePositive(field, s, cashUnit)
		return &m, err
	}
	pv.Target = security.Name
	pv.Changes = []tool.Change{{Field: "instrument", After: tool.TextValue(string(security.Instrument))}}
	amountChange := func(m *money.Money) {
		if m != nil {
			pv.Changes = append(pv.Changes, tool.Change{Field: "amount", After: tool.MoneyValue(*m)})
		}
	}
	if in.Kind == "income" {
		gross, err := tool.ParsePositive("gross", in.Gross, cashUnit)
		if err != nil {
			return pv, nil, err
		}
		withheld, err := optional("withheld", in.Withheld)
		if err != nil {
			return pv, nil, err
		}
		o := domain.IncomeOrder{
			AccountID: security.ID, CashAccountID: cash.ID, CategoryID: categoryID, Type: domain.IncomeType(in.IncomeType),
			Date: in.Date.Time, Gross: gross, Withheld: withheld,
		}
		amountChange(&gross)
		amountChange(withheld)
		pv.Changes = append(pv.Changes, tool.Change{Field: "account", After: tool.TextValue(cash.Name)}, tool.Change{Field: "date", After: tool.DateValue(in.Date.Time)})
		return pv, func() (recordInvestmentOut, error) {
			t, err := svc.RecordIncome(ctx, userID, o)
			return recordInvestmentOut{TransactionID: t.ID.String()}, err
		}, nil
	}
	secUnit, err := svc.AmountOf(ctx, 0, security.Instrument)
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
	fees, err := optional("fees", in.Fees)
	if err != nil {
		return pv, nil, err
	}
	taxes, err := optional("taxes", in.Taxes)
	if err != nil {
		return pv, nil, err
	}
	o := domain.TradeOrder{
		AccountID: security.ID, CashAccountID: cash.ID, Side: domain.Side(in.Kind), Date: in.Date.Time,
		Quantity: quantity, UnitPrice: price, Fees: fees, Taxes: taxes,
	}
	pv.Changes = append(pv.Changes, tool.Change{Field: "quantity", After: tool.TextValue(quantity.Decimal())}, tool.Change{Field: "price", After: tool.TextValue(price.String())})
	amountChange(fees)
	amountChange(taxes)
	pv.Changes = append(pv.Changes, tool.Change{Field: "account", After: tool.TextValue(cash.Name)}, tool.Change{Field: "date", After: tool.DateValue(in.Date.Time)})
	return pv, func() (recordInvestmentOut, error) {
		t, err := svc.RecordTrade(ctx, userID, o)
		return recordInvestmentOut{TransactionID: t.ID.String()}, err
	}, nil
}
