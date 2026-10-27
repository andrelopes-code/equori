package toolapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

type getFinancialIndicatorsIn struct {
	Month string `json:"month,omitzero" jsonschema:"the last month of the series, written YYYY-MM; the current month when absent"`
}

// ratioView carries bp always: ADR 012 T4 admits no nullable type.
type ratioView struct {
	BP     int64  `json:"bp" jsonschema:"basis points truncated toward zero; 0 and meaningless when reason is present"`
	Reason string `json:"reason,omitzero" jsonschema:"present when the ratio has no value: no_income, no_expense or insufficient_history"`
}

type indicatorView struct {
	Month               string     `json:"month"`
	Income              tool.Money `json:"income"`
	Expense             tool.Money `json:"expense"`
	Committed           tool.Money `json:"committed"`
	DebtService         tool.Money `json:"debt_service"`
	LiquidBalance       tool.Money `json:"liquid_balance"`
	Liabilities         tool.Money `json:"liabilities"`
	MeanIncome          tool.Money `json:"mean_income,omitzero" jsonschema:"absent when the trailing window holds fewer than 3 months"`
	MeanExpense         tool.Money `json:"mean_expense,omitzero" jsonschema:"absent when the trailing window holds fewer than 3 months"`
	SavingsRate         ratioView  `json:"savings_rate"`
	TrailingSavingsRate ratioView  `json:"trailing_savings_rate"`
	Liquidity           ratioView  `json:"liquidity"`
	CommittedShare      ratioView  `json:"committed_share"`
	DebtServiceShare    ratioView  `json:"debt_service_share"`
}

type getFinancialIndicatorsOut struct {
	Months []indicatorView `json:"months"`
}

func getFinancialIndicators(svc *app.Service, clk app.Clock) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_financial_indicators",
		Description: "Returns 12 months of financial indicators in the cash view, oldest first, the last one the month asked: " +
			"savings rate, trailing 12-month savings rate, liquidity (10000 bp = one month of mean expense), committed share " +
			"and debt service share of mean income, with their amounts. A ratio with a reason has no value. " +
			"Use it for how much is saved, how long the reserve lasts, and how much income is committed or spent on debt. " +
			"Do not use it for category totals: get_category_totals lists them.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, userID int64, in getFinancialIndicatorsIn) (getFinancialIndicatorsOut, error) {
		now := clk.Now()
		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
		month := today
		if in.Month != "" {
			var err error
			if month, err = time.Parse("2006-01", in.Month); err != nil {
				return getFinancialIndicatorsOut{}, tool.InvalidArgument("month", "must be written YYYY-MM")
			}
		}
		report, err := svc.Indicators(ctx, userID, month, today)
		if err != nil {
			return getFinancialIndicatorsOut{}, err
		}
		cur := money.Currency(report.Currency)
		amount := func(v int64) (tool.Money, error) {
			m, err := money.New(v, cur)
			return tool.MoneyOf(m), err
		}
		out := getFinancialIndicatorsOut{Months: make([]indicatorView, len(report.Months))}
		for i, m := range report.Months {
			v := indicatorView{
				Month: m.Month.Format("2006-01"), SavingsRate: ratioOf(m.SavingsRate),
				TrailingSavingsRate: ratioOf(m.TrailingSavingsRate), Liquidity: ratioOf(m.Liquidity),
				CommittedShare: ratioOf(m.CommittedShare), DebtServiceShare: ratioOf(m.DebtServiceShare),
			}
			for _, f := range []struct {
				to *tool.Money
				v  int64
			}{
				{&v.Income, m.Income}, {&v.Expense, m.Expense}, {&v.Committed, m.Committed},
				{&v.DebtService, m.DebtService}, {&v.LiquidBalance, m.Liquid}, {&v.Liabilities, m.Liabilities},
			} {
				if *f.to, err = amount(f.v); err != nil {
					return getFinancialIndicatorsOut{}, err
				}
			}
			if m.HasMeans {
				if v.MeanIncome, err = amount(m.MeanIncome); err != nil {
					return getFinancialIndicatorsOut{}, err
				}
				if v.MeanExpense, err = amount(m.MeanExpense); err != nil {
					return getFinancialIndicatorsOut{}, err
				}
			}
			out.Months[i] = v
		}
		return out, nil
	})
}

func ratioOf(r app.Ratio) ratioView {
	if r.Reason != "" {
		return ratioView{Reason: string(r.Reason)}
	}
	return ratioView{BP: r.BP}
}
