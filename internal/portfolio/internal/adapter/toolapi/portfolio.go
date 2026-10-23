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
	IncomeTypes []string       `json:"income_types,omitzero"`
	Subtypes    []string       `json:"subtypes,omitzero"`
}

func getPortfolio(svc *app.Service, names AccountNames, today func() time.Time) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_portfolio",
		Description: "Returns investment views at a date: positions with quantity, cost and market value; allocation by instrument type, currency or institution; net worth; or the annual return of an account over a period. " +
			"Also lists the income types and instrument subtypes the user's tax jurisdiction accepts. " +
			"Use it for questions about investments and net worth. " +
			"Do not use it for cash balances only: get_balances does; nor for a tax year: get_tax_year does.",
		Effect:     tool.ReadOnly,
		Idempotent: true,
	}, func(ctx context.Context, userID int64, in getPortfolioIn) (getPortfolioOut, error) {
		fields := []field{
			{"date", !in.Date.IsZero()}, {"by", in.By != ""}, {"account_id", in.AccountID != ""},
			{"from", !in.From.IsZero()}, {"to", !in.To.IsZero()}, {"instrument_type", in.InstrumentType != ""},
		}
		name := "view " + string(in.View)
		date := in.Date.Time
		if date.IsZero() {
			date = today()
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
			return positions(ctx, svc, names, userID, date)
		case "allocation":
			r, err := svc.Allocation(ctx, userID, date, string(in.By), "")
			if err != nil {
				return getPortfolioOut{}, err
			}
			out := getPortfolioOut{Total: tool.MoneyOf(r.Total), Groups: []groupView{}}
			for _, g := range r.Groups {
				out.Groups = append(out.Groups, groupView{Key: g.Key, Value: tool.MoneyOf(g.Value), ShareBP: g.ShareBP})
			}
			return out, nil
		case "net_worth":
			r, err := svc.NetWorth(ctx, userID, date, "")
			if err != nil {
				return getPortfolioOut{}, err
			}
			return getPortfolioOut{Assets: tool.MoneyOf(r.Assets), Liabilities: tool.MoneyOf(r.Liabilities), Net: tool.MoneyOf(r.Net)}, nil
		case "return":
			id, err := optionalID(in.AccountID, "account_id")
			if err != nil {
				return getPortfolioOut{}, err
			}
			r, err := svc.Return(ctx, userID, id, in.From.Time, in.To.Time, "")
			if err != nil {
				return getPortfolioOut{}, err
			}
			return getPortfolioOut{AnnualBP: r.AnnualBP, Opening: tool.MoneyOf(r.Opening), Closing: tool.MoneyOf(r.Closing)}, nil
		case "income_types":
			types, err := svc.IncomeTypes(ctx, userID)
			return getPortfolioOut{IncomeTypes: nonNil(types)}, err
		}
		subtypes, err := svc.Subtypes(ctx, userID, string(in.InstrumentType))
		return getPortfolioOut{Subtypes: nonNil(subtypes)}, err
	})
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

func positions(ctx context.Context, svc *app.Service, names AccountNames, userID int64, date time.Time) (getPortfolioOut, error) {
	ps, err := svc.Positions(ctx, userID, date)
	if err != nil {
		return getPortfolioOut{}, err
	}
	named, err := names(ctx, userID)
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
