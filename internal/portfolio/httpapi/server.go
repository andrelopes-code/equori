// Package httpapi serves the portfolio operations of api/openapi.yaml.
package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

const BaseURL = "/api/v1"

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
}

// Register lists every route of the portfolio operations.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET "+BaseURL+"/positions",
		httpserver.Handle(s.errs, http.StatusOK, s.listPositions))
	mux.HandleFunc("GET "+BaseURL+"/realized-results",
		httpserver.Handle(s.errs, http.StatusOK, s.listRealizedResults))
	mux.HandleFunc("GET "+BaseURL+"/income-events",
		httpserver.Handle(s.errs, http.StatusOK, s.listIncomeEvents))
	mux.HandleFunc("GET "+BaseURL+"/fixed-income-events",
		httpserver.Handle(s.errs, http.StatusOK, s.listFixedIncomeEvents))
	mux.HandleFunc("GET "+BaseURL+"/investment-income-types",
		httpserver.Handle(s.errs, http.StatusOK, s.listInvestmentIncomeTypes))
	mux.HandleFunc("GET "+BaseURL+"/reports/return",
		httpserver.Handle(s.errs, http.StatusOK, s.getReturn))
	mux.HandleFunc("GET "+BaseURL+"/reports/allocation",
		httpserver.Handle(s.errs, http.StatusOK, s.getAllocation))
	mux.HandleFunc("GET "+BaseURL+"/reports/net-worth",
		httpserver.Handle(s.errs, http.StatusOK, s.getNetWorth))
	mux.HandleFunc("GET "+BaseURL+"/reports/net-worth/days",
		httpserver.Handle(s.errs, http.StatusOK, s.getNetWorthDays))
	mux.HandleFunc("GET "+BaseURL+"/issuer-exposure",
		httpserver.Handle(s.errs, http.StatusOK, s.getIssuerExposure))
	mux.HandleFunc("GET "+BaseURL+"/contribution-plan",
		httpserver.Handle(s.errs, http.StatusOK, s.getContributionPlan))
	mux.HandleFunc("PUT "+BaseURL+"/contribution-plan",
		httpserver.Handle(s.errs, http.StatusOK, s.saveContributionPlan))
	mux.HandleFunc("POST "+BaseURL+"/contribution-plan/preview",
		httpserver.Handle(s.errs, http.StatusOK, s.previewContributionPlan))
	mux.HandleFunc("GET "+BaseURL+"/instrument-subtypes",
		httpserver.Handle(s.errs, http.StatusOK, s.listInstrumentSubtypes))
}

func (s *Server) listPositions(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (PositionList, error) {
	params, err := httpserver.Query[ListPositionsParams](r)
	if err != nil {
		return PositionList{}, err
	}

	ps, err := s.svc.Positions(
		ctx,
		auth.MustBooksID(ctx),
		params.Date.Time,
		valueIn(params.ValueIn),
	)
	if err != nil {
		return PositionList{}, err
	}

	items := positionItems(ps)

	warnings, err := s.svc.QuoteWarnings(ctx, auth.MustBooksID(ctx), params.Date.Time)
	if err != nil {
		return PositionList{}, err
	}

	return PositionList{Items: items, QuoteWarnings: quoteWarnings(warnings)}, nil
}

func positionItems(ps []app.Position) []Position {
	items := make([]Position, len(ps))
	for i, p := range ps {
		items[i] = Position{
			AccountId:  p.AccountID,
			Instrument: string(p.Instrument),
			Quantity:   toMoney(p.Quantity),
			CostBasis:  toMoney(p.CostBasis),
		}
		if p.AverageCost != nil {
			avg := p.AverageCost.String()
			items[i].AverageCost = &avg
		}

		if p.MarketValue != nil {
			v := toMoney(*p.MarketValue)

			prices := make([]Price, len(p.Prices))
			for j, x := range p.Prices {
				prices[j] = Price{
					Instrument:      string(x.Instrument),
					QuoteInstrument: string(x.Quote),
					Date:            date(x.Date),
					Value:           x.Value.Reduced().String(),
					Source:          x.Source,
				}
			}

			items[i].MarketValue, items[i].Prices = &v, &prices
		}
	}

	return items
}

func (s *Server) listInstrumentSubtypes(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (SubtypeList, error) {
	params, err := httpserver.Query[ListInstrumentSubtypesParams](r)
	if err != nil {
		return SubtypeList{}, err
	}

	subtypes, err := s.svc.Subtypes(ctx, auth.MustBooksID(ctx), string(params.Type))
	if err != nil {
		return SubtypeList{}, err
	}

	return SubtypeList{Items: subtypes}, nil
}

// valueIn reads the optional value_in parameter; empty selects the base currency.
func valueIn(p *string) money.Currency {
	if p == nil {
		return ""
	}

	return money.Currency(*p)
}

// optional maps the empty string, the domain's absence of a value, to JSON null.
func optional(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func toMoney(
	m money.Money,
) Money {
	return Money{Amount: m.Amount(), Currency: string(m.Currency())}
}

func quoteWarnings(ws []app.QuoteWarning) []PositionQuoteWarning {
	out := make([]PositionQuoteWarning, len(ws))
	for i, w := range ws {
		out[i] = PositionQuoteWarning{Instrument: string(w.Instrument)}
		if w.Last != nil {
			d := date(*w.Last)
			out[i].Last = &d
		}
	}

	return out
}

func date(t time.Time) openapi_types.Date { return openapi_types.Date{Time: t} }
