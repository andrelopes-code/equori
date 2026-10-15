package contract

import (
	"encoding/json/v2"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const spec = `
openapi: 3.0.3
info: {title: test, version: "1"}
security:
  - session: []
paths:
  /items:
    get:
      parameters:
        - {name: limit, in: query, schema: {type: integer, minimum: 1, maximum: 200}}
        - {name: from, in: query, schema: {type: string, format: date}}
      responses: {"200": {description: OK}}
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: "#/components/schemas/ItemInput"}
      responses: {"201": {description: Created}}
  /items/{id}:
    get:
      parameters:
        - {name: id, in: path, required: true, schema: {type: string, format: uuid}}
      responses: {"200": {description: OK}}
  /items/{id}/files:
    post:
      parameters:
        - {name: id, in: path, required: true, schema: {type: string, format: uuid}}
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema: {type: object, properties: {file: {type: string, format: binary}}}
      responses: {"201": {description: Created}}
components:
  securitySchemes:
    session: {type: apiKey, in: cookie, name: session}
  schemas:
    ItemInput:
      type: object
      additionalProperties: false
      required: [name, lines]
      properties:
        name: {type: string, minLength: 1, maxLength: 5}
        kind: {type: string, enum: [a, b]}
        lines:
          type: array
          maxItems: 2
          items:
            type: object
            additionalProperties: false
            required: [amount]
            properties:
              amount: {type: integer}
`

const itemID = "01a140de-2df9-729e-9a70-f46e7ad59fcb"

func serve(t *testing.T, method, path, contentType, body string) (*httptest.ResponseRecorder, string) {
	t.Helper()
	v, err := New([]byte(spec), "/api/v1")
	if err != nil {
		t.Fatal(err)
	}
	var reached string
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		reached = "handler:" + string(b)
	})
	req := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	v.Middleware(next).ServeHTTP(rec, req)
	return rec, reached
}

func fields(t *testing.T, rec *httptest.ResponseRecorder) []string {
	t.Helper()
	var d problem.Details
	if err := json.Unmarshal(rec.Body.Bytes(), &d); err != nil {
		t.Fatalf("decode %s: %v", rec.Body, err)
	}
	out := make([]string, len(d.Errors))
	for i, e := range d.Errors {
		out[i] = e.Field
	}
	slices.Sort(out)
	return out
}

func TestValidatorRejectsContractViolations(t *testing.T) {
	tests := []struct {
		name, method, path, contentType, body string
		status                                int
		code                                  string
		fields                                []string
	}{
		{"unknown member", "POST", "/api/v1/items", "application/json", `{"name":"x","lines":[],"colour":"red"}`, 400, "invalid_request", []string{"colour"}},
		{"unknown nested member", "POST", "/api/v1/items", "application/json", `{"name":"x","lines":[{"amount":1,"memo":"m"}]}`, 400, "invalid_request", []string{"lines[0].memo"}},
		{"missing required", "POST", "/api/v1/items", "application/json", `{"lines":[]}`, 400, "invalid_request", []string{"name"}},
		{"wrong type", "POST", "/api/v1/items", "application/json", `{"name":"x","lines":[{"amount":"1"}]}`, 400, "invalid_request", []string{"lines[0].amount"}},
		{"every violation", "POST", "/api/v1/items", "application/json", `{"name":"","kind":"c","lines":[{},{},{}]}`, 400, "invalid_request", []string{"kind", "lines", "lines[0].amount", "lines[1].amount", "lines[2].amount", "name"}},
		{"empty body", "POST", "/api/v1/items", "application/json", ``, 400, "invalid_request", []string{"body"}},
		{"trailing value", "POST", "/api/v1/items", "application/json", `{"name":"x","lines":[]} {}`, 400, "invalid_request", []string{"body"}},
		{"malformed json", "POST", "/api/v1/items", "application/json", `{"name":`, 400, "invalid_request", []string{"body"}},
		{"wrong media type", "POST", "/api/v1/items", "text/plain", `{"name":"x","lines":[]}`, 415, "unsupported_media_type", []string{}},
		{"invalid uuid", "GET", "/api/v1/items/not-a-uuid", "", "", 400, "invalid_request", []string{"id"}},
		{"invalid date", "GET", "/api/v1/items?from=2026-13-01", "", "", 400, "invalid_request", []string{"from"}},
		{"limit out of range", "GET", "/api/v1/items?limit=0", "", "", 400, "invalid_request", []string{"limit"}},
		{"multipart with json media type", "POST", "/api/v1/items/" + itemID + "/files", "application/json", `{}`, 415, "unsupported_media_type", []string{}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec, reached := serve(t, tc.method, tc.path, tc.contentType, tc.body)
			if reached != "" {
				t.Fatal("the handler ran for an invalid request")
			}
			if rec.Code != tc.status || rec.Header().Get("Content-Type") != problem.ContentType || !strings.Contains(rec.Body.String(), `"code":"`+tc.code+`"`) {
				t.Fatalf("status %d: %s", rec.Code, rec.Body)
			}
			if got := fields(t, rec); !slices.Equal(got, tc.fields) {
				t.Fatalf("fields = %v, want %v: %s", got, tc.fields, rec.Body)
			}
		})
	}
}

func TestValidatorPassesConformingRequests(t *testing.T) {
	tests := []struct{ name, method, path, contentType, body string }{
		{"json body reaches the handler intact", "POST", "/api/v1/items", "application/json; charset=utf-8", `{"name":"x","kind":"a","lines":[{"amount":-1}]}`},
		{"uuid v7 path", "GET", "/api/v1/items/" + itemID, "", ""},
		{"query", "GET", "/api/v1/items?limit=200&from=2026-02-28", "", ""},
		{"multipart body is not read", "POST", "/api/v1/items/" + itemID + "/files", "multipart/form-data; boundary=x", "--x--"},
		{"unknown api path is left to the router", "GET", "/api/v1/nope", "", ""},
		{"non-api path", "GET", "/healthz", "", ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec, reached := serve(t, tc.method, tc.path, tc.contentType, tc.body)
			if reached != "handler:"+tc.body {
				t.Fatalf("handler saw %q, status %d: %s", reached, rec.Code, rec.Body)
			}
		})
	}
}

func TestValidatorAnswersWrongMethod(t *testing.T) {
	rec, reached := serve(t, "DELETE", "/api/v1/items", "", "")
	if reached != "" || rec.Code != http.StatusMethodNotAllowed || !strings.Contains(rec.Body.String(), `"code":"method_not_allowed"`) {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	if got := rec.Header().Get("Allow"); got != "GET, POST" {
		t.Fatalf("Allow = %q", got)
	}
}

// untouched fails the test when the validator reads a body it must leave to the handler.
type untouched struct {
	t       *testing.T
	handler *bool
	r       io.Reader
}

func (u untouched) Read(p []byte) (int, error) {
	if !*u.handler {
		u.t.Error("the validator read the upload body")
	}
	return u.r.Read(p)
}

func (u untouched) Close() error { return nil }

func TestValidatorDoesNotReadUploads(t *testing.T) {
	v, err := New([]byte(spec), "/api/v1")
	if err != nil {
		t.Fatal(err)
	}
	var inHandler bool
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inHandler = true
		if b, _ := io.ReadAll(r.Body); string(b) != "--x--" {
			t.Errorf("handler body = %q", b)
		}
	})
	req := httptest.NewRequestWithContext(t.Context(), "POST", "/api/v1/items/"+itemID+"/files", nil)
	req.Body = untouched{t: t, handler: &inHandler, r: strings.NewReader("--x--")}
	req.Header.Set("Content-Type", "multipart/form-data; boundary=x")
	v.Middleware(next).ServeHTTP(httptest.NewRecorder(), req)
	if !inHandler {
		t.Fatal("the handler did not run")
	}
}
