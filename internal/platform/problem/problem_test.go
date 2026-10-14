package problem

import (
	"encoding/json/v2"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWrite(t *testing.T) {
	rec := httptest.NewRecorder()
	d := New(http.StatusNotFound, "account_not_found", "account 42 does not exist")
	d.RequestID = "req-1"

	Write(rec, d)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
	if ct := rec.Header().Get("Content-Type"); ct != ContentType {
		t.Fatalf("content type = %q, want %q", ct, ContentType)
	}
	var got map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"type":       "about:blank",
		"title":      "Not Found",
		"status":     float64(404),
		"detail":     "account 42 does not exist",
		"code":       "account_not_found",
		"request_id": "req-1",
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s = %v, want %v", k, got[k], v)
		}
	}
	if _, ok := got["errors"]; ok {
		t.Errorf("errors present without field errors")
	}
}
