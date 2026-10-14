// Package problem writes RFC 9457 problem details responses (ADR 004).
package problem

import (
	"encoding/json/v2"
	"net/http"
)

const ContentType = "application/problem+json"

type Details struct {
	Type      string       `json:"type"`
	Title     string       `json:"title"`
	Status    int          `json:"status"`
	Detail    string       `json:"detail,omitempty"`
	Code      string       `json:"code"`
	RequestID string       `json:"request_id,omitempty"`
	Errors    []FieldError `json:"errors,omitempty"`
}

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func New(status int, code, detail string) Details {
	return Details{
		Type:   "about:blank",
		Title:  http.StatusText(status),
		Status: status,
		Detail: detail,
		Code:   code,
	}
}

func Write(w http.ResponseWriter, d Details) {
	w.Header().Set("Content-Type", ContentType)
	w.WriteHeader(d.Status)
	_ = json.MarshalWrite(w, d)
}
