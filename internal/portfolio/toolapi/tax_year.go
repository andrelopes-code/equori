package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

type getTaxYearView string

func (getTaxYearView) Values() []string {
	return []string{"sales", "income", "both", "gain_tax", "abroad_tax"}
}

type getTaxYearIn struct {
	Year int            `json:"year"          jsonschema:"year in which the owner's tax year starts"`
	View getTaxYearView `json:"view,omitzero" jsonschema:"sales gives realized results, income gives income events, gain_tax the monthly tax on variable income, abroad_tax the annual tax on investments held abroad; both when absent"`
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

	// DeductibleContributions is the base of the deduction of pension contributions.
	DeductibleContributions tool.Money `json:"deductible_contributions,omitzero"`

	GainTax []gainTaxMonthView `json:"gain_tax,omitzero"`

	OpeningLosses []openingLossView `json:"opening_losses,omitzero"`

	AbroadTax abroadTaxView `json:"abroad_tax,omitzero"`
}

// openingLossView is the loss of a pool carried from before the book's history, from its month.
type openingLossView struct {
	Pool   string     `json:"pool"`
	Month  string     `json:"month"`
	Amount tool.Money `json:"amount"`
}

// abroadTaxView is the annual tax of the investments quoted in another currency (U-08).
type abroadTaxView struct {
	Gains       tool.Money `json:"gains"`
	Losses      tool.Money `json:"losses"`
	LossUsed    tool.Money `json:"loss_used"`
	LossCarried tool.Money `json:"loss_carried"`
	Base        tool.Money `json:"base"`
	Tax         tool.Money `json:"tax"`
	Credit      tool.Money `json:"credit"       jsonschema:"tax paid abroad deducted"`
	Due         tool.Money `json:"due"          jsonschema:"to pay in the annual return"`
}

type gainTaxMonthView struct {
	Month string            `json:"month"`
	Lines []gainTaxLineView `json:"lines"`
	Darf  tool.Money        `json:"darf"  jsonschema:"amount to pay; zero when below the minimum and carried"`

	CryptoDarf tool.Money `json:"crypto_darf,omitzero" jsonschema:"the crypto pool's own DARF"`
}

type gainTaxLineView struct {
	Pool        string     `json:"pool"`
	Result      tool.Money `json:"result"`
	Exempt      tool.Money `json:"exempt"`
	LossUsed    tool.Money `json:"loss_used"`
	LossCarried tool.Money `json:"loss_carried"`
	Base        tool.Money `json:"base"`
	Tax         tool.Money `json:"tax"`
	Withheld    tool.Money `json:"withheld"`
}

func getTaxYear(svc *app.Service, names AccountNames) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_tax_year",
		Description: "Returns a tax year of investments: realized results of sales at average cost with their tax class, and investment income with its tax treatment. " +
			"deductible_contributions is what the year paid into plans whose contributions are deducted from taxable income (PGBL in Brazil, up to 12% of it); " +
			"a pension_pgbl redemption is taxed on its whole proceeds, a pension_vgbl one on its result. " +
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

		if in.View == "gain_tax" || in.View == "abroad_tax" {
			return taxView(ctx, svc, booksID, in, out)
		}

		paid, ok, err := svc.DeductibleContributions(ctx, booksID, in.Year)
		if ok && !paid.IsZero() {
			out.DeductibleContributions = tool.MoneyOf(paid)
		}

		return out, err
	})
}

// taxView adds to out the monthly tax of variable income or the annual tax abroad that in asks.
func taxView(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in getTaxYearIn,
	out getTaxYearOut,
) (getTaxYearOut, error) {
	var err error
	if in.View == "gain_tax" {
		if out.GainTax, err = gainTaxMonths(ctx, svc, booksID, in.Year); err != nil {
			return out, err
		}

		out.OpeningLosses, err = openingLossViews(ctx, svc, booksID)
	} else {
		out.AbroadTax, err = abroadTax(ctx, svc, booksID, in.Year)
	}

	return out, err
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

func openingLossViews(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
) ([]openingLossView, error) {
	_, losses, base, err := svc.OpeningLosses(ctx, booksID)
	if err != nil {
		return nil, err
	}

	out := make([]openingLossView, len(losses))
	for i, l := range losses {
		amount, err := money.New(l.Amount, base)
		if err != nil {
			return nil, err
		}

		out[i] = openingLossView{
			Pool:   l.Pool,
			Month:  l.Month.Format("2006-01"),
			Amount: tool.MoneyOf(amount),
		}
	}

	return out, nil
}

// gainTaxMonths states the monthly tax in the base currency of the book (monthly gain tax design).
func gainTaxMonths(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	year int,
) ([]gainTaxMonthView, error) {
	months, base, err := svc.GainTax(ctx, booksID, year)
	if err != nil || len(months) == 0 {
		return nil, err
	}

	cents := func(v int64) (tool.Money, error) {
		m, err := money.New(v, base)
		return tool.MoneyOf(m), err
	}

	out := make([]gainTaxMonthView, len(months))
	for i, m := range months {
		v := gainTaxMonthView{Month: m.Month.Format("2006-01")}
		if v.Darf, err = cents(m.Darf); err != nil {
			return nil, err
		}

		if m.CryptoDarf != 0 {
			if v.CryptoDarf, err = cents(m.CryptoDarf); err != nil {
				return nil, err
			}
		}

		for _, l := range m.Lines {
			line := gainTaxLineView{Pool: l.Pool}
			for _, f := range []struct {
				dst *tool.Money
				v   int64
			}{
				{&line.Result, l.Result}, {&line.Exempt, l.Exempt}, {&line.LossUsed, l.LossUsed},
				{&line.LossCarried, l.LossCarried}, {&line.Base, l.Base}, {&line.Tax, l.Tax},
				{&line.Withheld, l.Withheld},
			} {
				if *f.dst, err = cents(f.v); err != nil {
					return nil, err
				}
			}

			v.Lines = append(v.Lines, line)
		}

		out[i] = v
	}

	return out, nil
}

// abroadTax states the annual tax on the investments held abroad; zero when the year has none.
func abroadTax(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	year int,
) (abroadTaxView, error) {
	y, base, ok, err := svc.AbroadTax(ctx, booksID, year)
	if err != nil || !ok {
		return abroadTaxView{}, err
	}

	v := abroadTaxView{}
	for _, f := range []struct {
		dst *tool.Money
		amt int64
	}{
		{&v.Gains, y.Gains}, {&v.Losses, y.Losses}, {&v.LossUsed, y.LossUsed},
		{&v.LossCarried, y.LossCarried}, {&v.Base, y.Base}, {&v.Tax, y.Tax},
		{&v.Credit, y.Credit}, {&v.Due, y.Due},
	} {
		m, err := money.New(f.amt, base)
		if err != nil {
			return abroadTaxView{}, err
		}

		*f.dst = tool.MoneyOf(m)
	}

	return v, nil
}
