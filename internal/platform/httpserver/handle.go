package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// None is the In type of a handler without a JSON body and the Out type of a handler that
// answers 204 No Content.
type None struct{}

// Handle adapts a handler to an http.HandlerFunc. It decodes the JSON body into In (nothing for
// None), calls fn and writes the result as JSON with status (204 and no body for None). A decoding
// error goes through WriteRequestError and an error of fn through Write. fn reads the path, the
// query and the headers from the request.
func Handle[In, Out any](
	e ErrorWriter,
	status int,
	fn func(ctx context.Context, r *http.Request, in In) (Out, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in In
		if _, none := any(in).(None); !none {
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				e.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))

				return
			}
		}

		out, err := fn(r.Context(), r, in)
		if err != nil {
			e.Write(w, r, err)

			return
		}

		if _, none := any(out).(None); none {
			w.WriteHeader(http.StatusNoContent)

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
