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
	"github.com/andrelopes-code/equori/internal/platform/problem"
	"github.com/andrelopes-code/equori/internal/portfolio/internal/app"
)

const BaseURL = "/api/v1"

var _ StrictServerInterface = (*Server)(nil)

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: toProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  s.errs.WriteRequestError,
		ResponseErrorHandlerFunc: s.errs.Write,
	})
	HandlerWithOptions(strict, StdHTTPServerOptions{BaseURL: BaseURL, BaseRouter: mux, ErrorHandlerFunc: s.errs.WriteRequestError})
}

func (s *Server) ListPositions(ctx context.Context, req ListPositionsRequestObject) (ListPositionsResponseObject, error) {
	ps, err := s.svc.Positions(ctx, auth.MustUserID(ctx), req.Params.Date.Time)
	if err != nil {
		return nil, err
	}
	items := make([]Position, len(ps))
	for i, p := range ps {
		items[i] = Position{
			AccountId: p.AccountID, Instrument: string(p.Instrument), Quantity: toMoney(p.Quantity), CostBasis: toMoney(p.CostBasis),
			AverageCost: p.AverageCost.String(),
		}
		if p.MarketValue != nil {
			v := toMoney(*p.MarketValue)
			prices := make([]Price, len(p.Prices))
			for j, x := range p.Prices {
				prices[j] = Price{Instrument: string(x.Instrument), QuoteInstrument: string(x.Quote), Date: date(x.Date), Value: x.Value.Reduced().String(), Source: PriceSource(x.Source)}
			}
			items[i].MarketValue, items[i].Prices = &v, &prices
		}
	}
	return ListPositions200JSONResponse{Items: items}, nil
}

func (s *Server) ListRealizedResults(ctx context.Context, req ListRealizedResultsRequestObject) (ListRealizedResultsResponseObject, error) {
	rs, err := s.svc.RealizedResults(ctx, auth.MustUserID(ctx), req.Params.Year)
	if err != nil {
		return nil, err
	}
	items := make([]RealizedResult, len(rs))
	for i, r := range rs {
		items[i] = RealizedResult{
			TransactionId: r.TransactionID, AccountId: r.AccountID, Instrument: string(r.Instrument), Date: date(r.Date),
			Month: r.Month.Format("2006-01"), Quantity: toMoney(r.QuantityAmount), Cost: toMoney(r.CostAmount),
			Proceeds: toMoney(r.Proceeds), Result: toMoney(r.ResultAmount), TaxClass: InstrumentType(r.TaxClass),
		}
	}
	return ListRealizedResults200JSONResponse{Items: items}, nil
}

func (s *Server) ListIncomeEvents(ctx context.Context, req ListIncomeEventsRequestObject) (ListIncomeEventsResponseObject, error) {
	es, err := s.svc.IncomeEvents(ctx, auth.MustUserID(ctx), req.Params.Year)
	if err != nil {
		return nil, err
	}
	items := make([]IncomeEvent, len(es))
	for i, e := range es {
		items[i] = IncomeEvent{
			TransactionId: e.TransactionID, AccountId: e.AccountID, Instrument: string(e.Instrument), Date: date(e.Date),
			IncomeType: IncomeType(e.Type), TaxTreatment: IncomeEventTaxTreatment(e.TaxTreatment),
			Gross: toMoney(e.GrossAmount), Withheld: toMoney(e.WithheldAmount),
		}
	}
	return ListIncomeEvents200JSONResponse{Items: items}, nil
}

func toMoney(m money.Money) Money { return Money{Amount: m.Amount(), Currency: string(m.Currency())} }

func date(t time.Time) openapi_types.Date { return openapi_types.Date{Time: t} }

// toProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004);
// the module returns none of its own.
func toProblem(error) (problem.Details, bool) { return problem.Details{}, false }
