package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// decodeBody decodes the JSON body of r into T. On failure it writes the 400 problem and returns
// false.
func decodeBody[T any](s *Server, w http.ResponseWriter, r *http.Request) (T, bool) {
	var in T
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))
		return in, false
	}

	return in, true
}

// writeJSONCookie answers status with body as JSON and the Set-Cookie header cookie.
func (s *Server) writeJSONCookie(
	w http.ResponseWriter,
	r *http.Request,
	status int,
	cookie string,
	body any,
) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		s.errs.Write(w, r, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Set-Cookie", cookie)
	w.WriteHeader(status)
	_, _ = buf.WriteTo(w)
}

// optional returns nil for an empty string, so the API omits the field.
func optional(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func deref(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}
