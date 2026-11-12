package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// HandleCreated is Handle for an operation that answers 201 with a Location header: fn returns
// the body and the value of the header (ADR 007, C6).
func HandleCreated[In, Out any](
	e ErrorWriter,
	fn func(ctx context.Context, r *http.Request, in In) (Out, string, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in In
		if _, none := any(in).(None); !none {
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				e.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))

				return
			}
		}

		out, loc, err := fn(r.Context(), r, in)
		if err != nil {
			e.Write(w, r, err)

			return
		}

		WriteCreated(e, w, r, loc, out)
	}
}

// WriteCreated answers 201 with the JSON body and the Location header of the created record. A
// custom handler that reads its own request (a multipart body) calls it on success.
func WriteCreated(
	e ErrorWriter,
	w http.ResponseWriter,
	r *http.Request,
	location string,
	body any,
) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		e.Write(w, r, err)

		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Location", location)
	w.WriteHeader(http.StatusCreated)
	_, _ = buf.WriteTo(w)
}
