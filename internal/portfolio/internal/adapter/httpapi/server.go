package httpapi

import (
	"context"
	"errors"
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
		}
		if p.AverageCost != nil {
			avg := p.AverageCost.String()
			items[i].AverageCost = &avg
		}
		if p.MarketValue != nil {
			v := toMoney(*p.MarketValue)
			prices := make([]Price, len(p.Prices))
			for j, x := range p.Prices {
				prices[j] = Price{Instrument: string(x.Instrument), QuoteInstrument: string(x.Quote), Date: date(x.Date), Value: x.Value.Reduced().String(), Source: x.Source}
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
			Proceeds: toMoney(r.Proceeds), Result: toMoney(r.ResultAmount), TaxClass: optional(r.TaxClass),
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
			IncomeType: IncomeType(e.Type), TaxTreatment: optional(e.TaxTreatment),
			Gross: toMoney(e.GrossAmount), Withheld: toMoney(e.WithheldAmount),
		}
	}
	return ListIncomeEvents200JSONResponse{Items: items}, nil
}

func (s *Server) ListInvestmentIncomeTypes(ctx context.Context, _ ListInvestmentIncomeTypesRequestObject) (ListInvestmentIncomeTypesResponseObject, error) {
	types, err := s.svc.IncomeTypes(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	items := make([]IncomeType, len(types))
	for i, t := range types {
		items[i] = IncomeType(t)
	}
	return ListInvestmentIncomeTypes200JSONResponse{Items: items}, nil
}

func (s *Server) ListInstrumentSubtypes(ctx context.Context, req ListInstrumentSubtypesRequestObject) (ListInstrumentSubtypesResponseObject, error) {
	subtypes, err := s.svc.Subtypes(ctx, auth.MustUserID(ctx), string(req.Params.Type))
	if err != nil {
		return nil, err
	}
	return ListInstrumentSubtypes200JSONResponse{Items: subtypes}, nil
}

func (s *Server) GetReturn(ctx context.Context, req GetReturnRequestObject) (GetReturnResponseObject, error) {
	var in money.Currency
	if req.Params.ValueIn != nil {
		in = money.Currency(*req.Params.ValueIn)
	}
	r, err := s.svc.Return(ctx, auth.MustUserID(ctx), req.Params.AccountId, req.Params.From.Time, req.Params.To.Time, in)
	if err != nil {
		return nil, err
	}
	out := GetReturn200JSONResponse{AnnualBp: r.AnnualBP, Opening: toMoney(r.Opening), Closing: toMoney(r.Closing), Flows: make([]ReturnFlow, len(r.Flows))}
	for i, f := range r.Flows {
		out.Flows[i] = ReturnFlow{Date: date(f.Date), Amount: toMoney(f.Amount)}
	}
	return out, nil
}

func (s *Server) GetAllocation(ctx context.Context, req GetAllocationRequestObject) (GetAllocationResponseObject, error) {
	r, err := s.svc.Allocation(ctx, auth.MustUserID(ctx), req.Params.Date.Time, string(req.Params.By), valueIn(req.Params.ValueIn))
	if err != nil {
		return nil, err
	}
	out := GetAllocation200JSONResponse{Total: toMoney(r.Total), Groups: make([]AllocationGroup, len(r.Groups))}
	for i, g := range r.Groups {
		out.Groups[i] = AllocationGroup{Key: g.Key, Value: toMoney(g.Value), ShareBp: g.ShareBP}
	}
	return out, nil
}

func (s *Server) GetNetWorth(ctx context.Context, req GetNetWorthRequestObject) (GetNetWorthResponseObject, error) {
	r, err := s.svc.NetWorth(ctx, auth.MustUserID(ctx), req.Params.Date.Time, valueIn(req.Params.ValueIn))
	if err != nil {
		return nil, err
	}
	return GetNetWorth200JSONResponse{Assets: toMoney(r.Assets), Liabilities: toMoney(r.Liabilities), Net: toMoney(r.Net)}, nil
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

func toMoney(m money.Money) Money { return Money{Amount: m.Amount(), Currency: string(m.Currency())} }

func date(t time.Time) openapi_types.Date { return openapi_types.Date{Time: t} }

// toProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004);
// the module returns none of its own.
func toProblem(err error) (problem.Details, bool) {
	switch {
	case errors.Is(err, app.ErrInvalidReturnRange):
		d := problem.New(http.StatusBadRequest, "invalid_request", "from must not be after to, and the period must not exceed 366 days")
		d.Errors = []problem.FieldError{{Field: "to", Message: "must be on or after from and at most 365 days after it"}}
		return d, true
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "account not found"), true
	case errors.Is(err, app.ErrPriceMissing):
		return problem.New(http.StatusUnprocessableEntity, "price_missing", err.Error()), true
	case errors.Is(err, app.ErrReturnUndefined):
		return problem.New(http.StatusUnprocessableEntity, "return_undefined", "no money was invested in the period, or the return has no solution"), true
	}
	return problem.Details{}, false
}
