package httpserver

import (
	"log/slog"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/problem"
)

// ErrorWriter writes the problem of an error raised while serving a module's request (ADR 004).
type ErrorWriter struct {
	Log *slog.Logger
	// Map translates the module's errors; false leaves the error unknown, which becomes 500.
	Map func(error) (problem.Details, bool)
}

// Write is the handler error path: transport errors, then the module's errors, then 500.
func (e ErrorWriter) Write(w http.ResponseWriter, r *http.Request, err error) {
	d, ok := problem.Transport(err)
	if !ok {
		d, ok = e.Map(err)
	}
	if !ok {
		d = problem.New(http.StatusInternalServerError, "internal_error", "")
	}
	e.write(w, r, d, err)
}

// WriteRequestError is the path of the generated code's decoding errors. Requests reach
// it only after the contract validator accepted them (ADR 007), so it carries no field.
func (e ErrorWriter) WriteRequestError(w http.ResponseWriter, r *http.Request, err error) {
	d, ok := problem.Transport(err)
	if !ok {
		d = problem.New(http.StatusBadRequest, "invalid_request", "malformed request")
	}
	e.write(w, r, d, err)
}

func (e ErrorWriter) write(w http.ResponseWriter, r *http.Request, d problem.Details, err error) {
	d.RequestID = RequestID(r.Context())
	if d.Status >= http.StatusInternalServerError {
		e.Log.ErrorContext(r.Context(), "request failed", "error", err, "request_id", d.RequestID)
	}
	problem.Write(w, d)
}
