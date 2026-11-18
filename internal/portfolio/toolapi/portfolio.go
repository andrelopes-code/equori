package toolapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

type getPortfolioView string

func (getPortfolioView) Values() []string {
	return []string{
		"positions",
		"allocation",
		"net_worth",
		"return",
		"income_types",
		"subtypes",
		"contribution",
		"fixed_income_events",
		"issuer_exposure",
	}
}

type getPortfolioBy string

func (getPortfolioBy) Values() []string { return []string{"type", "currency", "institution"} }

type getPortfolioInstrumentType string

func (getPortfolioInstrumentType) Values() []string {
	return []string{
		"currency",
		"stock",
		"etf",
		"reit",
		"depositary_receipt",
		"fixed_income",
		"fund",
		"crypto",
	}
}

type getPortfolioIn struct {
	View           getPortfolioView           `json:"view"                     jsonschema:"what to return"`
	Date           tool.Date                  `json:"date,omitzero"            jsonschema:"for positions, allocation, net_worth and issuer_exposure: valuation date; today when absent"`
	By             getPortfolioBy             `json:"by,omitzero"              jsonschema:"for allocation: grouping"`
	AccountID      string                     `json:"account_id,omitzero"      jsonschema:"for return: account or brokerage from list_accounts"`
	From           tool.Date                  `json:"from,omitzero"            jsonschema:"for return and fixed_income_events: first date"`
	To             tool.Date                  `json:"to,omitzero"              jsonschema:"for return and fixed_income_events: last date"`
	InstrumentType getPortfolioInstrumentType `json:"instrument_type,omitzero" jsonschema:"for subtypes: instrument type"`
	Amount         string                     `json:"amount,omitzero"          jsonschema:"for contribution: amount to contribute as a decimal in the base currency, such as 4000.00; absent returns the saved plan without a split"`
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
	ReturnBP  int    `json:"return_bp,omitzero"  jsonschema:"time-weighted return up to until in basis points; absent when undefined or zero"`
	IndexBP   int    `json:"index_bp"`
	PercentBP int    `json:"percent_bp,omitzero" jsonschema:"percent of the index that grows as much, 10000 is 100%; absent when undefined or zero"`

	AnnualBP      int `json:"annual_bp,omitzero"       jsonschema:"return_bp as a rate a year on the index's year basis; absent when undefined or zero"`
	IndexAnnualBP int `json:"index_annual_bp,omitzero" jsonschema:"index_bp as a rate a year on the same basis; absent when undefined or zero"`
	ExcessBP      int `json:"excess_bp,omitzero"       jsonschema:"return_bp minus index_bp; absent when undefined or zero"`
	Days          int `json:"days"`
	Skipped       int `json:"skipped,omitzero"         jsonschema:"rates of the period left out: days without money, or before a savings account recorded its first yield"`

	Credits        int  `json:"credits,omitzero"          jsonschema:"yield credits the return covers; absent when none"`
	Restarted      bool `json:"restarted,omitzero"        jsonschema:"a deposit or withdrawal between two credits more than 7 days apart moved the start of the comparison to the credit after it"`
	StartedLate    bool `json:"started_late,omitzero"     jsonschema:"a rate of the period dated before from was left out: the comparison starts after the first rate day of the window"`
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
	PeriodBP    int            `json:"period_bp,omitzero"          jsonschema:"for return: time-weighted return of the period in basis points; absent when undefined or zero"`
	Profile     string         `json:"profile,omitzero"            jsonschema:"for return: rate when every holding is cash or fixed income in the report's currency, market otherwise"`
	Index       string         `json:"index,omitzero"              jsonschema:"for return: the daily index the report compares with, the named one or the region's default; absent when the region has none"`
	Benchmark   benchmarkView  `json:"benchmark,omitzero"`
	Reason      string         `json:"unavailable_reason,omitzero" jsonschema:"for return: why benchmark or its percent is absent - no_index_for_region, currency_mismatch, nothing_held, no_yield_recorded, single_credit, too_small, too_few_days, no_rate_in_window or percent_undefined"`
	Excluded    excludedView   `json:"excluded,omitzero"           jsonschema:"for return: income and expense of the period treated as money in or out, not as yield"`
	Inflation   inflationView  `json:"inflation,omitzero"`
	IncomeTypes []string       `json:"income_types,omitzero"`
	Subtypes    []string       `json:"subtypes,omitzero"`

	Contribution contributionView `json:"contribution,omitzero" jsonschema:"for contribution: the saved target split valued today, with the split of amount when given"`

	FixedIncomeEvents []fixedIncomeEventView `json:"fixed_income_events,omitzero" jsonschema:"for fixed_income_events: interest, amortization and maturity payments dated in the range, with their state"`

	Issuers       []issuerExposureView `json:"issuers,omitzero"        jsonschema:"for issuer_exposure: fixed income per issuer, with covered, sovereign and uncovered value, limit and excess"`
	Guarantee     guaranteeView        `json:"guarantee,omitzero"      jsonschema:"for issuer_exposure: deposit guarantee; absent when none"`
	PeriodNote    bool                 `json:"period_note,omitzero"    jsonschema:"for issuer_exposure: covered values exceed the period limit"`
	MissingPrices []string             `json:"missing_prices,omitzero" jsonschema:"for issuer_exposure: instruments without a price"`

	Current currentView `json:"current,omitzero" jsonschema:"for positions, allocation and net_worth at today: set when market values took current quotes read during the trading session instead of closes"`
}

func getPortfolio(
	svc *app.Service,
	names AccountNames,
	today func(context.Context) time.Time,
) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_portfolio",
		Description: "Returns investment views at a date: positions with quantity, cost and market value; allocation by instrument type, currency or institution; net worth; or the annual return of an account over a period, with its time-weighted return and the percent of the default index of the region (the region's daily reference rate) that grows as much. " +
			"With view contribution it returns the saved contribution plan, a target split of the portfolio by class, valued today, and with amount the split of a contribution over its classes. " +
			"Also lists the income types and instrument subtypes the book's tax jurisdiction accepts. " +
			"At today a view with current holds values read during the trading session, not closes; with open true they are partial and change until the close. " +
			"Use it for investments and net worth. " +
			"Do not use it for cash balances only (get_balances) nor for a tax year (get_tax_year).",
		Effect:     tool.ReadOnly,
		Idempotent: true,
	}, func(ctx context.Context, booksID int64, in getPortfolioIn) (getPortfolioOut, error) {
		date := in.Date.Time
		if date.IsZero() {
			date = today(ctx)
		}

		if err := validatePortfolioIn(in); err != nil {
			return getPortfolioOut{}, err
		}

		return portfolioView(ctx, svc, names, booksID, date, in)
	})
}

func validatePortfolioIn(in getPortfolioIn) error {
	fields := []field{
		{"date", !in.Date.IsZero()}, {"by", in.By != ""}, {"account_id", in.AccountID != ""},
		{"from", !in.From.IsZero()}, {"to", !in.To.IsZero()},
		{"instrument_type", in.InstrumentType != ""}, {"amount", in.Amount != ""},
	}
	name := "view " + string(in.View)

	var err error
	switch in.View {
	case "positions", "net_worth", "issuer_exposure":
		err = optionalFields(name, fields, "date")
	case "allocation":
		err = optionalFields(name, fields, "date", "by")
		if err == nil && in.By == "" {
			err = tool.InvalidArgument("by", "is required for view allocation")
		}
	case "return":
		err = required(name, fields, "account_id", "from", "to")
	case "fixed_income_events":
		err = required(name, fields, "from", "to")
	case "subtypes":
		err = required(name, fields, "instrument_type")
	case "contribution":
		err = optionalFields(name, fields, "amount")
	default:
		err = required(name, fields)
	}

	return err
}

func portfolioView(
	ctx context.Context,
	svc *app.Service,
	names AccountNames,
	booksID int64,
	date time.Time,
	in getPortfolioIn,
) (getPortfolioOut, error) {
	switch in.View {
	case "positions":
		return positions(ctx, svc, names, booksID, date)
	case "allocation":
		return allocationView(ctx, svc, booksID, date, in)
	case "net_worth":
		r, err := svc.NetWorth(ctx, booksID, date, "")
		if err != nil {
			return getPortfolioOut{}, err
		}

		return getPortfolioOut{
			Assets:      tool.MoneyOf(r.Assets),
			Liabilities: tool.MoneyOf(r.Liabilities),
			Net:         tool.MoneyOf(r.Net),
			Current:     currentOf(r.Current),
		}, nil
	case "return":
		return returnView(ctx, svc, booksID, in)
	case "contribution":
		return contributionResult(ctx, svc, booksID, in)
	case "fixed_income_events":
		return fixedIncomeEventsView(ctx, svc, names, booksID, in)
	case "issuer_exposure":
		return issuerExposureResult(ctx, svc, booksID, date)
	case "income_types":
		types, err := svc.IncomeTypes(ctx, booksID)
		return getPortfolioOut{IncomeTypes: nonNil(types)}, err
	}

	subtypes, err := svc.Subtypes(ctx, booksID, string(in.InstrumentType))

	return getPortfolioOut{Subtypes: nonNil(subtypes)}, err
}

func allocationView(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	date time.Time,
	in getPortfolioIn,
) (getPortfolioOut, error) {
	r, err := svc.Allocation(ctx, booksID, date, string(in.By), "")
	if err != nil {
		return getPortfolioOut{}, err
	}

	out := getPortfolioOut{Total: tool.MoneyOf(r.Total), Groups: []groupView{}}
	for _, g := range r.Groups {
		out.Groups = append(out.Groups, groupView{
			Key:     g.Key,
			Value:   tool.MoneyOf(g.Value),
			ShareBP: g.ShareBP,
		})
	}

	out.Current = currentOf(r.Current)

	return out, nil
}

func returnView(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in getPortfolioIn,
) (getPortfolioOut, error) {
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
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}

	return s
}

func positions(
	ctx context.Context,
	svc *app.Service,
	names AccountNames,
	booksID int64,
	date time.Time,
) (getPortfolioOut, error) {
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
			AccountID:   p.AccountID.String(),
			AccountName: named[p.AccountID],
			Instrument:  string(p.Instrument),
			Quantity:    tool.MoneyOf(p.Quantity),
			CostBasis:   tool.MoneyOf(p.CostBasis),
		}
		if p.AverageCost != nil {
			v.AverageCost = p.AverageCost.String()
		}

		if p.MarketValue != nil {
			v.MarketValue = tool.MoneyOf(*p.MarketValue)
		}

		out.Positions = append(out.Positions, v)
	}

	out.Current = currentOf(app.PositionsCurrent(ps))

	return out, nil
}
