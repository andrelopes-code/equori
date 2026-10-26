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
	svc     *app.Service
	exports *app.Exports
	errs    httpserver.ErrorWriter
}

func NewServer(svc *app.Service, exports *app.Exports, log *slog.Logger) *Server {
	return &Server{svc: svc, exports: exports, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
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

func (s *Server) GetAccountFlows(ctx context.Context, req GetAccountFlowsRequestObject) (GetAccountFlowsResponseObject, error) {
	flows, instrument, err := s.svc.Flows(ctx, auth.MustUserID(ctx), req.Params.AccountId, req.Params.From.Time, req.Params.To.Time)
	if err != nil {
		return nil, err
	}
	out := GetAccountFlows200JSONResponse{Items: make([]FlowDay, len(flows))}
	for i, f := range flows {
		out.Items[i] = FlowDay{
			Date: flowDate(f), Inflow: Money{Amount: f.Inflow, Currency: instrument}, Outflow: Money{Amount: f.Outflow, Currency: instrument},
		}
	}
	return out, nil
}

func (s *Server) GetCategoryTotals(ctx context.Context, req GetCategoryTotalsRequestObject) (GetCategoryTotalsResponseObject, error) {
	view := app.ViewAccrual
	if req.Params.View != nil {
		view = app.View(*req.Params.View)
	}
	totals, err := s.svc.CategoryTotals(ctx, auth.MustUserID(ctx), string(req.Params.Class), req.Params.From.Time, req.Params.To.Time, view)
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
	case errors.Is(err, app.ErrInvalidFlowRange):
		d := problem.New(http.StatusBadRequest, "invalid_request", "from must not be after to, and the range must not exceed 366 days")
		d.Errors = []problem.FieldError{{Field: "to", Message: "must be on or after from and at most 365 days after it"}}
		return d, true
	case errors.Is(err, errFileRequired):
		d := problem.New(http.StatusBadRequest, "invalid_request", err.Error())
		d.Errors = []problem.FieldError{{Field: "file", Message: "is required"}}
		return d, true
	case errors.Is(err, app.ErrArchiveInvalid):
		d := problem.New(http.StatusUnprocessableEntity, "archive_invalid", err.Error())
		d.Errors = []problem.FieldError{{Field: "file", Message: err.Error()}}
		return d, true
	case errors.Is(err, app.ErrArchiveVersion):
		d := problem.New(http.StatusUnprocessableEntity, "archive_version_mismatch", err.Error())
		d.Errors = []problem.FieldError{{Field: "file", Message: err.Error()}}
		return d, true
	case errors.Is(err, app.ErrImportNotEmpty):
		return problem.New(http.StatusConflict, "import_not_empty", err.Error()), true
	case errors.Is(err, app.ErrImportConflict):
		return problem.New(http.StatusConflict, "import_conflict", err.Error()), true
	case errors.Is(err, app.ErrExportNotFound):
		return problem.New(http.StatusNotFound, "not_found", err.Error()), true
	case errors.Is(err, app.ErrExportPending):
		return problem.New(http.StatusConflict, "export_pending", err.Error()), true
	case errors.Is(err, app.ErrExportNotReady):
		return problem.New(http.StatusConflict, "export_not_ready", err.Error()), true
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "account not found"), true
	case errors.Is(err, app.ErrMixedInstruments):
		return problem.New(http.StatusUnprocessableEntity, "mixed_instruments", err.Error()), true
	}
	return problem.Details{}, false
}
