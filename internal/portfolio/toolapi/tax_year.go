package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

type getTaxYearView string

func (getTaxYearView) Values() []string { return []string{"sales", "income", "both"} }

type getTaxYearIn struct {
	Year int            `json:"year"          jsonschema:"year in which the owner's tax year starts"`
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
	From   tool.Date    `json:"from"`
	To     tool.Date    `json:"to"`
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
	}, func(ctx context.Context, booksID int64, in getTaxYearIn) (getTaxYearOut, error) {
		named, err := names(ctx, booksID)
		if err != nil {
			return getTaxYearOut{}, err
		}

		from, to, err := svc.TaxYear(ctx, booksID, in.Year)
		if err != nil {
			return getTaxYearOut{}, err
		}

		out := getTaxYearOut{From: tool.DateOf(from), To: tool.DateOf(to.AddDate(0, 0, -1))}
		if in.View != "income" {
			if out.Sales, err = taxYearSales(ctx, svc, booksID, in.Year, named); err != nil {
				return getTaxYearOut{}, err
			}
		}

		if in.View != "sales" {
			if out.Income, err = taxYearIncome(ctx, svc, booksID, in.Year, named); err != nil {
				return getTaxYearOut{}, err
			}
		}

		return out, nil
	})
}

func taxYearSales(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	year int,
	named map[uuid.UUID]string,
) ([]saleView, error) {
	rs, err := svc.RealizedResults(ctx, booksID, year)
	if err != nil {
		return nil, err
	}

	sales := []saleView{}
	for _, r := range rs {
		sales = append(sales, saleView{
			AccountName: named[r.AccountID],
			Instrument:  string(r.Instrument),
			Date:        tool.DateOf(r.Date),
			Quantity:    tool.MoneyOf(r.QuantityAmount),
			Cost:        tool.MoneyOf(r.CostAmount),
			Proceeds:    tool.MoneyOf(r.Proceeds),
			Result:      tool.MoneyOf(r.ResultAmount),
			TaxClass:    r.TaxClass,
		})
	}

	return sales, nil
}

func taxYearIncome(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	year int,
	named map[uuid.UUID]string,
) ([]incomeView, error) {
	es, err := svc.IncomeEvents(ctx, booksID, year)
	if err != nil {
		return nil, err
	}

	income := []incomeView{}
	for _, e := range es {
		income = append(income, incomeView{
			AccountName:  named[e.AccountID],
			Instrument:   string(e.Instrument),
			Date:         tool.DateOf(e.Date),
			IncomeType:   e.Type,
			TaxTreatment: e.TaxTreatment,
			Gross:        tool.MoneyOf(e.GrossAmount),
			Withheld:     tool.MoneyOf(e.WithheldAmount),
		})
	}

	return income, nil
}
