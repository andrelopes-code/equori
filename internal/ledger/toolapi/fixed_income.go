package toolapi

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

var percentPattern = regexp.MustCompile(`^(-?)(\d{1,4})(?:\.(\d+))?$`)

type recordFixedIncomeIn struct {
	BrokerageID   string    `json:"brokerage_id"             jsonschema:"Brokerage that holds the contract, from list_accounts"`
	CashAccountID string    `json:"cash_account_id,omitzero" jsonschema:"Cash of the Brokerage or an open account of its institution; the single candidate when absent"`
	AppliedOn     tool.Date `json:"applied_on"               jsonschema:"date of the application"`
	Amount        string    `json:"amount"                   jsonschema:"decimal amount applied, in the currency of the Brokerage"`
	Fees          string    `json:"fees,omitzero"            jsonschema:"positive fees charged"`
	Description   string    `json:"description,omitzero"     jsonschema:"description of the transaction"`

	Instrument string `json:"instrument,omitzero" jsonschema:"code of a contract the book holds, to put more money into it; instead of the contract fields"`

	Subtype        string    `json:"subtype,omitzero"          jsonschema:"new contract: kind, such as cdb, lci, lca or debenture"`
	Issuer         string    `json:"issuer,omitzero"           jsonschema:"new contract: name of the issuer"`
	IssuerScheme   string    `json:"issuer_scheme,omitzero"    jsonschema:"new contract: scheme of the issuer identifier, such as br_cnpj"`
	IssuerID       string    `json:"issuer_id,omitzero"        jsonschema:"new contract: identifier of the issuer under the scheme"`
	Name           string    `json:"name,omitzero"             jsonschema:"new contract: name; SUBTYPE issuer maturity when empty"`
	IssuedOn       tool.Date `json:"issued_on,omitzero"        jsonschema:"new contract: issue date; the application date when empty"`
	MaturesOn      tool.Date `json:"matures_on,omitzero"       jsonschema:"new contract: maturity date"`
	IndexID        string    `json:"index_id,omitzero"         jsonschema:"new contract: index, such as cdi or ipca; empty for a pre-fixed rate"`
	PercentOfIndex string    `json:"percent_of_index,omitzero" jsonschema:"new contract: percent of the index as text with at most 2 decimals, such as 110; 100 when empty"`
	Spread         string    `json:"spread,omitzero"           jsonschema:"new contract: spread over the index, or the pre-fixed rate without index, as percent text with at most 2 decimals, such as 6.5"`
	DayCount       string    `json:"day_count,omitzero"        jsonschema:"new contract: bus252 or act365; derived from the index and the region when empty"`
	CalendarID     string    `json:"calendar_id,omitzero"      jsonschema:"new contract: business day calendar of bus252; the region calendar when empty"`
	DailyLiquidity bool      `json:"daily_liquidity,omitzero"  jsonschema:"new contract: true when it can be redeemed any day"`
	RedeemableFrom tool.Date `json:"redeemable_from,omitzero"  jsonschema:"new contract: first date it can be redeemed"`
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

	pv.Target = fixedIncomeTitle(a)

	pv.Changes = []tool.Change{{Field: "amount", After: tool.MoneyValue(a.Amount)}}
	if cash.cashName != "" {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "account", After: tool.TextValue(cash.cashName)},
		)
	}

	pv.Changes = append(pv.Changes, tool.Change{Field: "date", After: tool.DateValue(a.AppliedOn)})

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
		"day_count":        in.DayCount != "",
		"calendar_id":      in.CalendarID != "",
		"daily_liquidity":  in.DailyLiquidity,
		"redeemable_from":  !in.RedeemableFrom.IsZero(),
	}
	common := []string{"cash_account_id", "fees", "description"}
	required := []string{"brokerage_id", "applied_on", "amount"}

	if in.Instrument != "" {
		return checkFields("a contribution", given, append(required, "instrument"), common...)
	}

	contract := []string{
		"issuer_scheme", "issuer_id", "name", "issued_on", "index_id", "percent_of_index",
		"spread", "day_count", "calendar_id", "daily_liquidity", "redeemable_from",
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

	if _, err = svc.Account(ctx, booksID, brokerageID); err != nil {
		return app.FixedIncomeApplication{}, err
	}

	currency, err := resolveTargetCash(ctx, svc, booksID, investmentIDs{cash: cashID}, cash)
	if err != nil {
		return app.FixedIncomeApplication{}, err
	}

	unit, err := svc.AmountOf(ctx, 0, currency)
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
	}

	if err = parseFixedIncomeAmounts(in, unit, &a); err != nil {
		return a, err
	}

	if in.Instrument == "" {
		c, err := fixedIncomeContract(in)
		a.Contract = &c

		return a, err
	}

	return a, nil
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

func fixedIncomeContract(in recordFixedIncomeIn) (app.Contract, error) {
	c := app.Contract{
		Subtype:        in.Subtype,
		IssuerName:     in.Issuer,
		IssuerScheme:   in.IssuerScheme,
		IssuerID:       in.IssuerID,
		Name:           in.Name,
		IssuedOn:       in.IssuedOn.Time,
		MaturesOn:      in.MaturesOn.Time,
		IndexID:        in.IndexID,
		DayCount:       in.DayCount,
		CalendarID:     in.CalendarID,
		DailyLiquidity: in.DailyLiquidity,
		RedeemableFrom: in.RedeemableFrom.Time,
	}

	if c.Name == "" {
		c.Name = fmt.Sprintf(
			"%s %s %s", strings.ToUpper(in.Subtype), in.Issuer, in.MaturesOn.Format("2006-01-02"),
		)
	}

	var err error
	if c.PercentOfIndexBP, err = percentToBP("percent_of_index", in.PercentOfIndex); err != nil {
		return c, err
	}

	c.SpreadBP, err = percentToBP("spread", in.Spread)

	return c, err
}

// percentToBP converts percent text ("110", "6.5") to basis points; empty is 0.
func percentToBP(field, s string) (int, error) {
	if s == "" {
		return 0, nil
	}

	m := percentPattern.FindStringSubmatch(s)
	if m == nil {
		return 0, tool.InvalidArgument(field, "must be a percent such as 110 or 6.5")
	}

	if len(m[3]) > 2 {
		return 0, tool.InvalidArgument(field, "must have at most 2 decimals")
	}

	whole, _ := strconv.Atoi(m[2])
	frac, _ := strconv.Atoi((m[3] + "00")[:2])
	bp := whole*100 + frac

	if m[1] == "-" {
		bp = -bp
	}

	return bp, nil
}

func fixedIncomeTitle(a app.FixedIncomeApplication) string {
	if a.Contract == nil {
		return string(a.Instrument)
	}

	c := a.Contract

	return fmt.Sprintf(
		"%s · %s · matures %s", c.Name, rateInWords(*c), c.MaturesOn.Format("2006-01-02"),
	)
}

// rateInWords states a contract's rate: "110% of CDI", "IPCA + 6.5%", "12% a year".
func rateInWords(c app.Contract) string {
	if c.IndexID == "" {
		return percentText(c.SpreadBP) + "% a year"
	}

	index := strings.ToUpper(c.IndexID)
	if c.PercentOfIndexBP != 0 && c.PercentOfIndexBP != 10000 {
		index = percentText(c.PercentOfIndexBP) + "% of " + index
	}

	if c.SpreadBP != 0 {
		index += " + " + percentText(c.SpreadBP) + "%"
	}

	return index
}

func percentText(bp int) string {
	s := fmt.Sprintf("%d.%02d", bp/100, bp%100)

	return strings.TrimSuffix(strings.TrimRight(s, "0"), ".")
}
