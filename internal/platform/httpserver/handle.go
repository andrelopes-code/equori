package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// Handle adapts a function over a JSON body to an http.HandlerFunc. It decodes the body into In,
// calls fn and writes the result as JSON with status. A decoding error goes through
// WriteRequestError and an error of fn through Write.
func Handle[In, Out any](
	e ErrorWriter,
	status int,
	fn func(ctx context.Context, in In) (Out, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in In
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			e.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))

			return
		}

		out, err := fn(r.Context(), in)
		if err != nil {
			e.Write(w, r, err)

			return
		}

		var buf bytes.Buffer
		if err := json.NewEncoder(&buf).Encode(out); err != nil {
			e.Write(w, r, err)

			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = buf.WriteTo(w)
	}
}
