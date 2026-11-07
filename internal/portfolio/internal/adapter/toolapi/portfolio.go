package toolapi

import (
	"context"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/app"
)

type getPortfolioView string

func (getPortfolioView) Values() []string {
	return []string{"positions", "allocation", "net_worth", "return", "income_types", "subtypes"}
}

type getPortfolioBy string

func (getPortfolioBy) Values() []string { return []string{"type", "currency", "institution"} }

type getPortfolioInstrumentType string

func (getPortfolioInstrumentType) Values() []string {
	return []string{"currency", "stock", "etf", "reit", "depositary_receipt", "fixed_income", "fund", "crypto"}
}

type getPortfolioIn struct {
	View           getPortfolioView           `json:"view" jsonschema:"what to return"`
	Date           tool.Date                  `json:"date,omitzero" jsonschema:"for positions, allocation and net_worth: valuation date; today when absent"`
	By             getPortfolioBy             `json:"by,omitzero" jsonschema:"for allocation: grouping"`
	AccountID      string                     `json:"account_id,omitzero" jsonschema:"for return: account or brokerage from list_accounts"`
	From           tool.Date                  `json:"from,omitzero" jsonschema:"for return: first date"`
	To             tool.Date                  `json:"to,omitzero" jsonschema:"for return: last date"`
	InstrumentType getPortfolioInstrumentType `json:"instrument_type,omitzero" jsonschema:"for subtypes: instrument type"`
}

type positionView struct {
	AccountID   string     `json:"account_id"`
	AccountName string     `json:"account_name"`
	Instrument  string     `json:"instrument"`
	Quantity    tool.Money `json:"quantity"`
	AverageCost string     `json:"average_cost,omitzero"`
	CostBasis   tool.Money `json:"cost_basis"`
	MarketValue tool.Money `json:"market_value,omitzero"`
}

type groupView struct {
	Key     string     `json:"key"`
	Value   tool.Money `json:"value"`
	ShareBP int        `json:"share_bp"`
}

// benchmarkView compares the time-weighted return with the default index of the book's region
// (amendment A208).
type benchmarkView struct {
	Index     string `json:"index"`
	From      string `json:"from"`
	Until     string `json:"until"`
	ReturnBP  int    `json:"return_bp,omitzero" jsonschema:"time-weighted return up to until in basis points; absent when undefined or zero"`
	IndexBP   int    `json:"index_bp"`
	PercentBP int    `json:"percent_bp,omitzero" jsonschema:"percent of the index that grows as much, 10000 is 100%; absent when undefined or zero"`

	AnnualBP      int `json:"annual_bp,omitzero" jsonschema:"return_bp as a rate a year on the index's year basis; absent when undefined or zero"`
	IndexAnnualBP int `json:"index_annual_bp,omitzero" jsonschema:"index_bp as a rate a year on the same basis; absent when undefined or zero"`
	ExcessBP      int `json:"excess_bp,omitzero" jsonschema:"return_bp minus index_bp; absent when undefined or zero"`
	Days          int `json:"days"`
	Skipped       int `json:"skipped,omitzero" jsonschema:"rates of the period left out: days without money, or before a savings account recorded its first yield"`

	Credits        int  `json:"credits,omitzero" jsonschema:"yield credits the return covers; absent when none"`
	Restarted      bool `json:"restarted,omitzero" jsonschema:"a deposit or withdrawal between two credits more than 7 days apart moved the start of the comparison to the credit after it"`
	StartedLate    bool `json:"started_late,omitzero" jsonschema:"a rate of the period dated before from was left out: the comparison starts after the first rate day of the window"`
	PercentErrorBP int  `json:"percent_error_bp,omitzero" jsonschema:"relative error bound of percent_bp and annual_bp in basis points of themselves, from rounding each credit to the cent"`
}

// excludedView is the income and the expense of a period that the comparison treated as money in
// or out, not as yield (amendment A208 R19).
type excludedView struct {
	Income  excludedPartView `json:"income,omitzero"`
	Expense excludedPartView `json:"expense,omitzero"`
}

type excludedPartView struct {
	Amount     tool.Money `json:"amount"`
	Categories []string   `json:"categories"`
}

// inflationView is the return net of inflation over whole months (amendment A208 R16).
type inflationView struct {
	Index    string `json:"index"`
	From     string `json:"from"`
	Until    string `json:"until"`
	IndexBP  int    `json:"index_bp"`
	ReturnBP int    `json:"return_bp"`
	RealBP   int    `json:"real_bp"`
}

type getPortfolioOut struct {
	Positions   []positionView `json:"positions,omitzero"`
	Total       tool.Money     `json:"total,omitzero"`
	Groups      []groupView    `json:"groups,omitzero"`
	Assets      tool.Money     `json:"assets,omitzero"`
	Liabilities tool.Money     `json:"liabilities,omitzero"`
	Net         tool.Money     `json:"net,omitzero"`
	AnnualBP    int            `json:"annual_bp,omitzero"`
	Opening     tool.Money     `json:"opening,omitzero"`
	Closing     tool.Money     `json:"closing,omitzero"`
	PeriodBP    int            `json:"period_bp,omitzero" jsonschema:"for return: time-weighted return of the period in basis points; absent when undefined or zero"`
	Profile     string         `json:"profile,omitzero" jsonschema:"for return: rate when every holding is cash or fixed income in the report's currency, market otherwise"`
	Index       string         `json:"index,omitzero" jsonschema:"for return: the daily index the report compares with, the named one or the region's default; absent when the region has none"`
	Benchmark   benchmarkView  `json:"benchmark,omitzero"`
	Reason      string         `json:"unavailable_reason,omitzero" jsonschema:"for return: why benchmark or its percent is absent - no_index_for_region, currency_mismatch, nothing_held, no_yield_recorded, single_credit, too_small, no_rate_in_window or percent_undefined"`
	Excluded    excludedView   `json:"excluded,omitzero" jsonschema:"for return: income and expense of the period treated as money in or out, not as yield"`
	Inflation   inflationView  `json:"inflation,omitzero"`
	IncomeTypes []string       `json:"income_types,omitzero"`
	Subtypes    []string       `json:"subtypes,omitzero"`
}

func getPortfolio(svc *app.Service, names AccountNames, today func(context.Context) time.Time) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_portfolio",
		Description: "Returns investment views at a date: positions with quantity, cost and market value; allocation by instrument type, currency or institution; net worth; or the annual return of an account over a period, with its time-weighted return and the percent of the default index of the region (the region's daily reference rate) that grows as much. " +
			"Also lists the income types and instrument subtypes the book's tax jurisdiction accepts. " +
			"Use it for questions about investments and net worth. " +
			"Do not use it for cash balances only: get_balances does; nor for a tax year: get_tax_year does.",
		Effect:     tool.ReadOnly,
		Idempotent: true,
	}, func(ctx context.Context, booksID int64, in getPortfolioIn) (getPortfolioOut, error) {
		fields := []field{
			{"date", !in.Date.IsZero()}, {"by", in.By != ""}, {"account_id", in.AccountID != ""},
			{"from", !in.From.IsZero()}, {"to", !in.To.IsZero()}, {"instrument_type", in.InstrumentType != ""},
		}
		name := "view " + string(in.View)

		date := in.Date.Time
		if date.IsZero() {
			date = today(ctx)
		}

		var err error
		switch in.View {
		case "positions", "net_worth":
			err = optionalFields(name, fields, "date")
		case "allocation":
			err = optionalFields(name, fields, "date", "by")
			if err == nil && in.By == "" {
				err = tool.InvalidArgument("by", "is required for view allocation")
			}
		case "return":
			err = required(name, fields, "account_id", "from", "to")
		case "subtypes":
			err = required(name, fields, "instrument_type")
		default:
			err = required(name, fields)
		}

		if err != nil {
			return getPortfolioOut{}, err
		}

		switch in.View {
		case "positions":
			return positions(ctx, svc, names, booksID, date)
		case "allocation":
			r, err := svc.Allocation(ctx, booksID, date, string(in.By), "")
			if err != nil {
				return getPortfolioOut{}, err
			}

			out := getPortfolioOut{Total: tool.MoneyOf(r.Total), Groups: []groupView{}}
			for _, g := range r.Groups {
				out.Groups = append(out.Groups, groupView{Key: g.Key, Value: tool.MoneyOf(g.Value), ShareBP: g.ShareBP})
			}

			return out, nil
		case "net_worth":
			r, err := svc.NetWorth(ctx, booksID, date, "")
			if err != nil {
				return getPortfolioOut{}, err
			}

			return getPortfolioOut{Assets: tool.MoneyOf(r.Assets), Liabilities: tool.MoneyOf(r.Liabilities), Net: tool.MoneyOf(r.Net)}, nil
		case "return":
			id, err := optionalID(in.AccountID, "account_id")
			if err != nil {
				return getPortfolioOut{}, err
			}

			r, err := svc.Return(ctx, booksID, id, in.From.Time, in.To.Time, "", "")
			if err != nil {
				return getPortfolioOut{}, err
			}

			return getPortfolioOut{
				AnnualBP:  r.AnnualBP,
				Opening:   tool.MoneyOf(r.Opening),
				Closing:   tool.MoneyOf(r.Closing),
				PeriodBP:  valueOf(r.PeriodBP),
				Benchmark: benchmarkOf(r.Benchmark),
				Inflation: inflationOf(r.Inflation),
				Profile:   r.Profile,
				Index:     r.Index,
				Reason:    r.UnavailableReason,
				Excluded:  excludedViewOf(r.Excluded),
			}, nil
		case "income_types":
			types, err := svc.IncomeTypes(ctx, booksID)
			return getPortfolioOut{IncomeTypes: nonNil(types)}, err
		}

		subtypes, err := svc.Subtypes(ctx, booksID, string(in.InstrumentType))

		return getPortfolioOut{Subtypes: nonNil(subtypes)}, err
	})
}

func excludedViewOf(e *app.Excluded) excludedView {
	if e == nil {
		return excludedView{}
	}

	part := func(t *app.ExcludedTotal) excludedPartView {
		if t == nil {
			return excludedPartView{}
		}

		return excludedPartView{Amount: tool.MoneyOf(t.Amount), Categories: t.Categories}
	}

	return excludedView{Income: part(e.Income), Expense: part(e.Expense)}
}

func inflationOf(i *app.Inflation) inflationView {
	if i == nil {
		return inflationView{}
	}

	return inflationView{
		Index:    i.Index,
		From:     i.From.Format(time.DateOnly),
		Until:    i.Until.Format(time.DateOnly),
		IndexBP:  i.IndexBP,
		ReturnBP: i.ReturnBP,
		RealBP:   i.RealBP,
	}
}

func benchmarkOf(b *app.Benchmark) benchmarkView {
	if b == nil {
		return benchmarkView{}
	}

	return benchmarkView{
		Index:     b.Index,
		From:      b.From.Format(time.DateOnly),
		Until:     b.Until.Format(time.DateOnly),
		ReturnBP:  valueOf(b.ReturnBP),
		IndexBP:   b.IndexBP,
		PercentBP: valueOf(b.PercentBP),

		AnnualBP:      valueOf(b.AnnualBP),
		IndexAnnualBP: valueOf(b.IndexAnnualBP),
		ExcessBP:      valueOf(b.ExcessBP),
		Days:          b.Days,
		Skipped:       b.Skipped,

		Credits:        b.Credits,
		Restarted:      b.Restarted,
		StartedLate:    b.StartedLate,
		PercentErrorBP: valueOf(b.PercentErrorBP),
	}
}

// valueOf is the integer p points to, or 0; a tool schema has no null (ADR 012 T4).
func valueOf(p *int) int {
	if p == nil {
		return 0
	}

	return *p
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}

	return s
}

// optionalFields rejects a field the view does not use; the fields in optional may be absent.
func optionalFields(name string, fields []field, optional ...string) error {
	for _, f := range fields {
		if f.given && !slices.Contains(optional, f.name) {
			return tool.InvalidArgument(f.name, "is not used by "+name)
		}
	}

	return nil
}

func positions(ctx context.Context, svc *app.Service, names AccountNames, booksID int64, date time.Time) (getPortfolioOut, error) {
	ps, err := svc.Positions(ctx, booksID, date, "")
	if err != nil {
		return getPortfolioOut{}, err
	}

	named, err := names(ctx, booksID)
	if err != nil {
		return getPortfolioOut{}, err
	}

	out := getPortfolioOut{Positions: []positionView{}}
	for _, p := range ps {
		v := positionView{
			AccountID: p.AccountID.String(), AccountName: named[p.AccountID], Instrument: string(p.Instrument),
			Quantity: tool.MoneyOf(p.Quantity), CostBasis: tool.MoneyOf(p.CostBasis),
		}
		if p.AverageCost != nil {
			v.AverageCost = p.AverageCost.String()
		}

		if p.MarketValue != nil {
			v.MarketValue = tool.MoneyOf(*p.MarketValue)
		}

		out.Positions = append(out.Positions, v)
	}

	return out, nil
}
