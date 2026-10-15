package server_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func problemFields(t *testing.T, r apitest.Response) []string {
	t.Helper()
	var p struct {
		Errors []struct {
			Field string `json:"field"`
		} `json:"errors"`
	}
	r.Decode(t, &p)
	out := make([]string, len(p.Errors))
	for i, e := range p.Errors {
		out[i] = e.Field
	}
	slices.Sort(out)
	return out
}

// The rows of the P3.5 plan's evidence table that concern requests (ADR 007, C1–C5).
func TestContractRejectsNonConformingRequests(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-01", apitest.Posting(checking, -100), apitest.Posting(food, 100))

	tests := []struct {
		name, method, path, contentType, body string
		status                                int
		code                                  string
		fields                                []string
	}{
		{"unknown member", "POST", "/api/v1/accounts", "application/json", `{"name":"X","class":"asset","kind":"cash","currency":"BRL","colour":"red"}`, 400, "invalid_request", []string{"colour"}},
		{"misspelled patch member", "PATCH", "/api/v1/accounts/" + checking, "application/json", `{"nmae":"Y"}`, 400, "invalid_request", []string{"nmae"}},
		{"wrong type", "POST", "/api/v1/transactions", "application/json", `{"date":"2026-10-01","postings":[{"account_id":"` + checking + `","amount":{"amount":"1","currency":"BRL"}},{"account_id":"` + food + `","amount":{"amount":1,"currency":"BRL"}}]}`, 400, "invalid_request", []string{"postings[0].amount.amount"}},
		{"invalid uuid", "GET", "/api/v1/accounts/not-a-uuid", "", "", 400, "invalid_request", []string{"id"}},
		{"invalid date", "GET", "/api/v1/accounts/" + checking + "/balance?date=2026-13-01", "", "", 400, "invalid_request", []string{"date"}},
		{"limit out of range", "GET", "/api/v1/transactions?limit=0", "", "", 400, "invalid_request", []string{"limit"}},
		{"invalid cursor", "GET", "/api/v1/transactions?cursor=zzz", "", "", 400, "invalid_request", []string{"cursor"}},
		{"plain text body", "POST", "/api/v1/accounts", "text/plain", `{"name":"X","class":"asset","kind":"cash","currency":"BRL"}`, 415, "unsupported_media_type", []string{}},
		{"trailing value", "POST", "/api/v1/accounts", "application/json", `{"name":"X","class":"asset","kind":"cash","currency":"BRL"} {}`, 400, "invalid_request", []string{"body"}},
		{"wrong method", "DELETE", "/api/v1/accounts", "", "", 405, "method_not_allowed", []string{}},
		{"unknown path", "GET", "/api/v1/nope", "", "", 404, "not_found", []string{}},
		// Review Focus 1: a conforming request that breaks a domain rule stays 422.
		{"domain rule", "POST", "/api/v1/transactions", "application/json", `{"date":"2026-10-01","postings":[{"account_id":"` + checking + `","amount":{"amount":0,"currency":"BRL"}},{"account_id":"` + food + `","amount":{"amount":0,"currency":"BRL"}}]}`, 422, "validation_failed", []string{"postings[0].amount"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req, err := http.NewRequestWithContext(t.Context(), tc.method, h.URL()+tc.path, strings.NewReader(tc.body))
			if err != nil {
				t.Fatal(err)
			}
			if tc.contentType != "" {
				req.Header.Set("Content-Type", tc.contentType)
			}
			r := h.Send(h.Client, req)
			h.ExpectProblem(r, tc.status, tc.code, "")
			if got := problemFields(t, r); !slices.Equal(got, tc.fields) {
				t.Fatalf("fields = %v, want %v: %s", got, tc.fields, r.Body)
			}
		})
	}
	if r := h.Do("DELETE", "/api/v1/accounts", nil); r.Header.Get("Allow") != "GET, POST" {
		t.Fatalf("Allow = %q", r.Header.Get("Allow"))
	}
}

// Review Focus 3: authentication runs before contract validation.
func TestUnauthenticatedInvalidRequestIs401(t *testing.T) {
	h := apitest.New(t)
	r := h.Call(http.DefaultClient, "POST", "/api/v1/accounts", map[string]any{"colour": "red"})
	h.ExpectProblem(r, http.StatusUnauthorized, "unauthenticated", "")
}

// ADR 007, C3: field rules live in the contract, so every invalid field is reported at once.
func TestContractReportsEveryInvalidField(t *testing.T) {
	h := apitest.New(t)
	r := h.Do("POST", "/api/v1/accounts", map[string]any{"name": "", "class": "foo", "kind": "", "currency": "brl"})
	h.ExpectProblem(r, http.StatusBadRequest, "invalid_request", "")
	if got, want := problemFields(t, r), []string{"class", "currency", "kind", "name"}; !slices.Equal(got, want) {
		t.Fatalf("fields = %v, want %v: %s", got, want, r.Body)
	}

	checking := h.Account("Nubank", "asset", "checking", nil)
	postings := make([]map[string]any, 501)
	for i := range postings {
		postings[i] = apitest.Posting(checking, 1)
	}
	r = h.Do("POST", "/api/v1/transactions", map[string]any{"date": "2026-10-01", "postings": postings})
	h.ExpectProblem(r, http.StatusBadRequest, "invalid_request", "postings")
}
