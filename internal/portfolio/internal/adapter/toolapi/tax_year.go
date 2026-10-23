package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/app"
)

type getTaxYearView string

func (getTaxYearView) Values() []string { return []string{"sales", "income", "both"} }

type getTaxYearIn struct {
	Year int            `json:"year" jsonschema:"calendar year"`
	View getTaxYearView `json:"view,omitzero" jsonschema:"sales gives realized results, income gives income events; both when absent"`
}

type saleView struct {
	AccountName string     `json:"account_name"`
	Instrument  string     `json:"instrument"`
	Date        tool.Date  `json:"date"`
	Quantity    tool.Money `json:"quantity"`
	Cost        tool.Money `json:"cost"`
	Proceeds    tool.Money `json:"proceeds"`
	Result      tool.Money `json:"result"`
	TaxClass    string     `json:"tax_class,omitzero"`
}

type incomeView struct {
	AccountName  string     `json:"account_name"`
	Instrument   string     `json:"instrument"`
	Date         tool.Date  `json:"date"`
	IncomeType   string     `json:"income_type"`
	TaxTreatment string     `json:"tax_treatment,omitzero"`
	Gross        tool.Money `json:"gross"`
	Withheld     tool.Money `json:"withheld"`
}

type getTaxYearOut struct {
	Sales  []saleView   `json:"sales,omitzero"`
	Income []incomeView `json:"income,omitzero"`
}

func getTaxYear(svc *app.Service, names AccountNames) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_tax_year",
		Description: "Returns a tax year of investments: realized results of sales at average cost with their tax class, and investment income with its tax treatment. " +
			"Use it to prepare a tax return or answer what was gained or received in a year. " +
			"Do not use it for current positions: get_portfolio does.",
		Effect:     tool.ReadOnly,
		Idempotent: true,
	}, func(ctx context.Context, userID int64, in getTaxYearIn) (getTaxYearOut, error) {
		named, err := names(ctx, userID)
		if err != nil {
			return getTaxYearOut{}, err
		}
		var out getTaxYearOut
		if in.View != "income" {
			rs, err := svc.RealizedResults(ctx, userID, in.Year)
			if err != nil {
				return getTaxYearOut{}, err
			}
			out.Sales = []saleView{}
			for _, r := range rs {
				out.Sales = append(out.Sales, saleView{
					AccountName: named[r.AccountID], Instrument: string(r.Instrument), Date: tool.DateOf(r.Date),
					Quantity: tool.MoneyOf(r.QuantityAmount), Cost: tool.MoneyOf(r.CostAmount), Proceeds: tool.MoneyOf(r.Proceeds),
					Result: tool.MoneyOf(r.ResultAmount), TaxClass: r.TaxClass,
				})
			}
		}
		if in.View != "sales" {
			es, err := svc.IncomeEvents(ctx, userID, in.Year)
			if err != nil {
				return getTaxYearOut{}, err
			}
			out.Income = []incomeView{}
			for _, e := range es {
				out.Income = append(out.Income, incomeView{
					AccountName: named[e.AccountID], Instrument: string(e.Instrument), Date: tool.DateOf(e.Date),
					IncomeType: e.Type, TaxTreatment: e.TaxTreatment, Gross: tool.MoneyOf(e.GrossAmount), Withheld: tool.MoneyOf(e.WithheldAmount),
				})
			}
		}
		return out, nil
	})
}
