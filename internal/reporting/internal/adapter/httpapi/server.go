package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

const BaseURL = "/api/v1"

var _ StrictServerInterface = (*Server)(nil)

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  s.errs.WriteRequestError,
		ResponseErrorHandlerFunc: s.errs.Write,
	})
	HandlerWithOptions(strict, StdHTTPServerOptions{BaseURL: BaseURL, BaseRouter: mux, ErrorHandlerFunc: s.errs.WriteRequestError})
}

func (s *Server) GetBalanceSeries(ctx context.Context, req GetBalanceSeriesRequestObject) (GetBalanceSeriesResponseObject, error) {
	basis := app.BasisBooked
	if req.Params.Basis != nil {
		basis = app.Basis(*req.Params.Basis)
	}
	points, currency, err := s.svc.Series(ctx, auth.MustUserID(ctx), req.Params.AccountId, req.Params.From.Time, req.Params.To.Time, basis)
	if err != nil {
		return nil, err
	}
	out := GetBalanceSeries200JSONResponse{Items: make([]BalancePoint, len(points))}
	for i, p := range points {
		out.Items[i] = BalancePoint{Date: dateOf(p), Balance: Money{Amount: p.Balance, Currency: currency}}
	}
	return out, nil
}

func (s *Server) GetCategoryTotals(ctx context.Context, req GetCategoryTotalsRequestObject) (GetCategoryTotalsResponseObject, error) {
	totals, err := s.svc.CategoryTotals(ctx, auth.MustUserID(ctx), string(req.Params.Class), req.Params.From.Time, req.Params.To.Time)
	if err != nil {
		return nil, err
	}
	out := GetCategoryTotals200JSONResponse{Items: make([]CategoryTotal, len(totals))}
	for i, t := range totals {
		out.Items[i] = CategoryTotal{
			AccountId: t.AccountID, Total: Money{Amount: t.Total, Currency: t.Instrument}, SubtreeTotal: Money{Amount: t.SubtreeTotal, Currency: t.Instrument},
		}
	}
	return out, nil
}

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func ToProblem(err error) (problem.Details, bool) {
	switch {
	case errors.Is(err, app.ErrInvalidRange):
		d := problem.New(http.StatusBadRequest, "invalid_request", "from must not be after to, and the range must not exceed 3660 days")
		d.Errors = []problem.FieldError{{Field: "to", Message: "must be on or after from and at most 3660 days after it"}}
		return d, true
	case errors.Is(err, app.ErrInvalidCategoryRange):
		d := problem.New(http.StatusBadRequest, "invalid_request", "from must not be after to, and the period must not exceed 366 days")
		d.Errors = []problem.FieldError{{Field: "to", Message: "must be on or after from and at most 365 days after it"}}
		return d, true
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "account not found"), true
	case errors.Is(err, app.ErrMixedInstruments):
		return problem.New(http.StatusUnprocessableEntity, "mixed_instruments", err.Error()), true
	}
	return problem.Details{}, false
}
