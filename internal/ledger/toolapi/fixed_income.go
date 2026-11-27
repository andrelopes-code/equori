package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type recordFixedIncomeIn struct {
	BrokerageID   string    `json:"brokerage_id"             jsonschema:"Brokerage that holds the contract, from list_accounts"`
	Opening       bool      `json:"opening,omitzero"         jsonschema:"true: held before the book, no cash"`
	CashAccountID string    `json:"cash_account_id,omitzero" jsonschema:"cash account of the Brokerage or its institution; the single candidate if absent"`
	AppliedOn     tool.Date `json:"applied_on"               jsonschema:"date of the application"`
	Amount        string    `json:"amount"                   jsonschema:"decimal amount applied, in the currency of the Brokerage"`
	Fees          string    `json:"fees,omitzero"            jsonschema:"positive fees charged"`
	ExchangeRate  string    `json:"exchange_rate,omitzero"   jsonschema:"base currency per cash unit; day rate if empty"`
	Description   string    `json:"description,omitzero"     jsonschema:"description of the transaction"`

	Instrument string `json:"instrument,omitzero" jsonschema:"code of a contract the book holds, to put more money into it; instead of the contract fields"`

	Subtype        string    `json:"subtype,omitzero"          jsonschema:"new contract: kind, such as cdb, lci, lca or debenture"`
	Issuer         string    `json:"issuer,omitzero"           jsonschema:"new contract: name of the issuer"`
	IssuerScheme   string    `json:"issuer_scheme,omitzero"    jsonschema:"new contract: issuer identifier scheme, such as br_cnpj"`
	IssuerID       string    `json:"issuer_id,omitzero"        jsonschema:"new contract: issuer identifier"`
	Name           string    `json:"name,omitzero"             jsonschema:"new contract: name; SUBTYPE issuer maturity when empty"`
	IssuedOn       tool.Date `json:"issued_on,omitzero"        jsonschema:"new contract: issue date; the application date when empty"`
	MaturesOn      tool.Date `json:"matures_on,omitzero"       jsonschema:"new contract: maturity date"`
	IndexID        string    `json:"index_id,omitzero"         jsonschema:"new contract: index, such as cdi or ipca; empty for a pre-fixed rate"`
	PercentOfIndex string    `json:"percent_of_index,omitzero" jsonschema:"new contract: percent of the index as text, such as 110; 100 when empty"`
	Spread         string    `json:"spread,omitzero"           jsonschema:"new contract: spread over the index, or the pre-fixed rate; percent text, such as 6.5"`
	DayCount       string    `json:"day_count,omitzero"        jsonschema:"new contract: bus252 or act365; derived when empty"`
	CalendarID     string    `json:"calendar_id,omitzero"      jsonschema:"new contract: bus252 calendar; the region calendar when empty"`
	DailyLiquidity bool      `json:"daily_liquidity,omitzero"  jsonschema:"new contract: true when it can be redeemed any day"`
	RedeemableFrom tool.Date `json:"redeemable_from,omitzero"  jsonschema:"new contract: first date it can be redeemed"`

	InterestEveryMonths int                       `json:"interest_every_months,omitzero" jsonschema:"new contract: interest every 1, 3, 6 or 12 months"`
	FirstPaymentOn      tool.Date                 `json:"first_payment_on,omitzero"      jsonschema:"new contract: first interest date"`
	Amortizations       []fixedIncomeAmortization `json:"amortizations,omitzero"         jsonschema:"new contract: principal returned by date"`
}

type fixedIncomeAmortization struct {
	PaysOn  tool.Date `json:"pays_on" jsonschema:"date"`
	Percent string    `json:"percent" jsonschema:"percent of the principal, such as 50"`
}

type recordFixedIncomeOut struct {
	Instrument    string `json:"instrument"`
	TransactionID string `json:"transaction_id"`
	Quantity      string `json:"quantity"`
	UnitPrice     string `json:"unit_price"`
}

func recordFixedIncome(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "record_fixed_income",
		Description: "Proposes a fixed income application: a new contract of a private issuer " +
			"(CDB, LCI, LCA, debenture and others) bought with cash of a brokerage, or more " +
			"money into a contract the book holds. " +
			"Use it when the user states an application with its issuer, amount, date, " +
			"maturity and rate. " +
			"Do not use it for a public security with a ticker: record_investment does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in recordFixedIncomeIn) (tool.Preview, error) {
		pv, _, err := planFixedIncome(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in recordFixedIncomeIn) (recordFixedIncomeOut, error) {
		_, a, err := planFixedIncome(ctx, svc, booksID, in)
		if err != nil {
			return recordFixedIncomeOut{}, err
		}

		r, err := svc.ApplyFixedIncome(ctx, booksID, a)

		return recordFixedIncomeOut{
			Instrument:    string(r.Instrument),
			TransactionID: r.TransactionID.String(),
			Quantity:      r.Quantity.Decimal(),
			UnitPrice:     r.UnitPrice.String(),
		}, err
	})
}

func planFixedIncome(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordFixedIncomeIn,
) (tool.Preview, app.FixedIncomeApplication, error) {
	pv := tool.Preview{Action: "record_fixed_income"}

	if err := checkFixedIncomeFields(in); err != nil {
		return pv, app.FixedIncomeApplication{}, err
	}

	var cash investmentTarget

	a, err := fixedIncomeApplication(ctx, svc, booksID, in, &cash)
	if err != nil {
		return pv, a, err
	}

	net, err := subtract(a.Amount.Neg(), a.Fees)
	if err != nil {
		return pv, a, err
	}

	pv.Target = string(a.Instrument)
	appendMoneyChange(&pv, "amount", &a.Amount)
	appendMoneyChange(&pv, "fees", a.Fees)
	appendMoneyChange(&pv, "net", &net)

	err = appendRateChanges(ctx, svc, booksID, &pv, in.ExchangeRate, a.ExchangeRate, net)
	if err != nil {
		return pv, a, err
	}

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "institution", After: tool.TextValue(cash.name)},
	)

	if in.Opening {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "opening", After: tool.TextValue("true")},
		)
	}

	if cash.cashName != "" {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "account", After: tool.TextValue(cash.cashName)},
		)
	}

	pv.Changes = append(pv.Changes, tool.Change{Field: "date", After: tool.DateValue(a.AppliedOn)})

	if a.Contract != nil {
		describeContract(&pv, *a.Contract)
	}

	return pv, a, nil
}

func checkFixedIncomeFields(in recordFixedIncomeIn) error {
	given := map[string]bool{
		"brokerage_id":     in.BrokerageID != "",
		"applied_on":       !in.AppliedOn.IsZero(),
		"amount":           in.Amount != "",
		"instrument":       in.Instrument != "",
		"subtype":          in.Subtype != "",
		"issuer":           in.Issuer != "",
		"matures_on":       !in.MaturesOn.IsZero(),
		"issuer_scheme":    in.IssuerScheme != "",
		"issuer_id":        in.IssuerID != "",
		"name":             in.Name != "",
		"issued_on":        !in.IssuedOn.IsZero(),
		"index_id":         in.IndexID != "",
		"percent_of_index": in.PercentOfIndex != "",
		"spread":           in.Spread != "",
		"opening":          in.Opening,
		"day_count":        in.DayCount != "",
		"calendar_id":      in.CalendarID != "",
		"daily_liquidity":  in.DailyLiquidity,
		"redeemable_from":  !in.RedeemableFrom.IsZero(),

		"interest_every_months": in.InterestEveryMonths != 0,
		"first_payment_on":      !in.FirstPaymentOn.IsZero(),
		"amortizations":         in.Amortizations != nil,
	}
	common := []string{"cash_account_id", "opening", "fees", "description"}
	required := []string{"brokerage_id", "applied_on", "amount"}

	if in.Instrument != "" {
		return checkFields("a contribution", given, append(required, "instrument"), common...)
	}

	contract := []string{
		"issuer_scheme", "issuer_id", "name", "issued_on", "index_id", "percent_of_index",
		"spread", "day_count", "calendar_id", "daily_liquidity", "redeemable_from",
		"interest_every_months", "first_payment_on", "amortizations",
	}

	return checkFields(
		"a new contract",
		given,
		append(required, "subtype", "issuer", "matures_on"),
		append(common, contract...)...,
	)
}

func fixedIncomeApplication(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordFixedIncomeIn,
	cash *investmentTarget,
) (app.FixedIncomeApplication, error) {
	brokerageID, err := uuid.Parse(in.BrokerageID)
	if err != nil {
		return app.FixedIncomeApplication{}, tool.InvalidArgument("brokerage_id", "is not a UUID")
	}

	cashID, err := optionalID(in.CashAccountID, "cash_account_id")
	if err != nil {
		return app.FixedIncomeApplication{}, err
	}

	ids := investmentIDs{cash: cashID, brokerage: brokerageID}

	unit, err := fixedIncomeUnit(ctx, svc, booksID, ids, in.Opening, cash)
	if err != nil {
		return app.FixedIncomeApplication{}, err
	}

	a := app.FixedIncomeApplication{
		ApplicationID: uuid.New(),
		BrokerageID:   brokerageID,
		CashAccountID: cashID,
		AppliedOn:     in.AppliedOn.Time,
		Description:   in.Description,
		Instrument:    money.Currency(in.Instrument),
		Opening:       in.Opening,
	}

	if err = parseFixedIncomeAmounts(in, unit, &a); err != nil {
		return a, err
	}

	if a.ExchangeRate, err = parseExchangeRate(in.ExchangeRate); err != nil {
		return a, err
	}

	if in.Instrument == "" {
		c, err := fixedIncomeContract(in)
		a.Contract = &c

		return a, err
	}

	return a, nil
}

// fixedIncomeUnit names cash after the brokerage and returns a zero amount in the currency of
// the cash account that pays the application.
func fixedIncomeUnit(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	ids investmentIDs,
	opening bool,
	cash *investmentTarget,
) (money.Money, error) {
	brokerage, err := svc.Account(ctx, booksID, ids.brokerage)
	if err != nil {
		return money.Money{}, err
	}

	cash.name = brokerage.Name

	var currency money.Currency
	if opening && ids.cash == uuid.Nil {
		settings, serr := svc.Settings(ctx, booksID)
		currency, err = settings.BaseCurrency, serr
	} else {
		currency, err = resolveTargetCash(ctx, svc, booksID, ids, cash)
	}

	if err != nil {
		return money.Money{}, err
	}

	return svc.AmountOf(ctx, 0, currency)
}

func parseFixedIncomeAmounts(
	in recordFixedIncomeIn,
	unit money.Money,
	a *app.FixedIncomeApplication,
) error {
	var err error
	if a.Amount, err = tool.ParsePositive("amount", in.Amount, unit); err != nil {
		return err
	}

	if in.Fees == "" {
		return nil
	}

	fees, err := tool.ParsePositive("fees", in.Fees, unit)
	a.Fees = &fees

	return err
}
