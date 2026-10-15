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
	svc *app.Service
	log *slog.Logger
}

func NewServer(svc *app.Service, log *slog.Logger) *Server { return &Server{svc: svc, log: log} }

func (s *Server) Register(mux *http.ServeMux) {
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  s.writeRequestError,
		ResponseErrorHandlerFunc: s.writeError,
	})
	HandlerWithOptions(strict, StdHTTPServerOptions{BaseURL: BaseURL, BaseRouter: mux, ErrorHandlerFunc: s.writeRequestError})
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

var errInvalidRequest = errors.New("invalid request")

func (s *Server) writeRequestError(w http.ResponseWriter, r *http.Request, err error) {
	s.writeError(w, r, errors.Join(errInvalidRequest, err))
}

func (s *Server) writeError(w http.ResponseWriter, r *http.Request, err error) {
	var d problem.Details
	if t, ok := problem.Transport(err); ok {
		d = t
	} else {
		switch {
		case errors.Is(err, errInvalidRequest):
			d = problem.New(http.StatusBadRequest, "invalid_request", "malformed request")
		case errors.Is(err, app.ErrInvalidRange):
			d = problem.New(http.StatusBadRequest, "invalid_request", "from must not be after to, and the range must not exceed 3660 days")
		case errors.Is(err, app.ErrNotFound):
			d = problem.New(http.StatusNotFound, "not_found", "account not found")
		default:
			d = problem.New(http.StatusInternalServerError, "internal_error", "")
		}
	}
	d.RequestID = httpserver.RequestID(r.Context())
	if d.Status >= http.StatusInternalServerError {
		s.log.ErrorContext(r.Context(), "request failed", "error", err, "request_id", d.RequestID)
	}
	problem.Write(w, d)
}
