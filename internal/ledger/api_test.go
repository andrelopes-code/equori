package ledger_test

import (
	"encoding/json/v2"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

const password = "correct horse battery"

// api wires identity and ledger the way cmd/equori does and logs one user in.
type api struct {
	t          *testing.T
	pool       *pgxpool.Pool
	dispatcher *outbox.Dispatcher
	identity   *identity.Module
	server     *httptest.Server
	client     *http.Client
}

func newAPI(t *testing.T) *api {
	t.Helper()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	pool := pgtest.New(t)
	d := outbox.NewDispatcher(pool, log)
	idm := identity.New(pool, identity.Config{}, log)
	lm := ledger.New(pool, d, log)
	mux := http.NewServeMux()
	idm.RegisterRoutes(mux)
	lm.RegisterRoutes(mux)
	mux.Handle("/api/", httpserver.NotFound())
	srv := httptest.NewServer(httpserver.Middleware(idm.RequireSession(mux), log))
	t.Cleanup(srv.Close)
	a := &api{t: t, pool: pool, dispatcher: d, identity: idm, server: srv}
	a.client = a.login("owner@example.com")
	return a
}

func (a *api) login(email string) *http.Client {
	a.t.Helper()
	if _, err := a.identity.CreateUser(a.t.Context(), email, password, identity.RoleAdmin); err != nil {
		a.t.Fatal(err)
	}
	if _, err := a.dispatcher.DispatchPending(a.t.Context()); err != nil {
		a.t.Fatal(err)
	}
	jar, err := cookiejar.New(nil)
	if err != nil {
		a.t.Fatal(err)
	}
	c := &http.Client{Jar: jar}
	if r := a.call(c, http.MethodPost, "/api/v1/session", map[string]string{"email": email, "password": password}); r.status != http.StatusNoContent {
		a.t.Fatalf("login status %d: %s", r.status, r.body)
	}
	return c
}

type response struct {
	status int
	body   []byte
}

func (r response) decode(t *testing.T, v any) {
	t.Helper()
	if err := json.Unmarshal(r.body, v); err != nil {
		t.Fatalf("decode %s: %v", r.body, err)
	}
}

func (a *api) call(c *http.Client, method, path string, body any) response {
	a.t.Helper()
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			a.t.Fatal(err)
		}
		reader = strings.NewReader(string(b))
	}
	req, err := http.NewRequestWithContext(a.t.Context(), method, a.server.URL+path, reader)
	if err != nil {
		a.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.Do(req)
	if err != nil {
		a.t.Fatal(err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		a.t.Fatal(err)
	}
	return response{status: resp.StatusCode, body: b}
}

func (a *api) do(method, path string, body any) response {
	a.t.Helper()
	return a.call(a.client, method, path, body)
}

func (a *api) mustDo(method, path string, body any, status int, out any) {
	a.t.Helper()
	r := a.do(method, path, body)
	if r.status != status {
		a.t.Fatalf("%s %s = %d, want %d: %s", method, path, r.status, status, r.body)
	}
	if out != nil {
		r.decode(a.t, out)
	}
}

type idOnly struct {
	ID string `json:"id"`
}

func (a *api) account(name, class, kind string) string {
	a.t.Helper()
	body := map[string]any{"name": name, "class": class, "currency": "BRL"}
	if kind != "" {
		body["kind"] = kind
	}
	var out idOnly
	a.mustDo(http.MethodPost, "/api/v1/accounts", body, http.StatusCreated, &out)
	return out.ID
}

func money(amount int64) map[string]any { return map[string]any{"amount": amount, "currency": "BRL"} }

func tx(date string, postings ...map[string]any) map[string]any {
	return map[string]any{"date": date, "description": "test", "postings": postings}
}

func posting(account string, amount int64) map[string]any {
	return map[string]any{"account_id": account, "amount": money(amount)}
}

type problemBody struct {
	Code   string `json:"code"`
	Errors []struct {
		Field string `json:"field"`
	} `json:"errors"`
}

func (a *api) expectProblem(r response, status int, code, field string) {
	a.t.Helper()
	if r.status != status {
		a.t.Fatalf("status = %d, want %d: %s", r.status, status, r.body)
	}
	var p problemBody
	r.decode(a.t, &p)
	if p.Code != code {
		a.t.Fatalf("code = %q, want %q: %s", p.Code, code, r.body)
	}
	if field != "" && (len(p.Errors) == 0 || p.Errors[0].Field != field) {
		a.t.Fatalf("field errors = %+v, want %q", p.Errors, field)
	}
}

func TestCreateAccountAndRecordExpense(t *testing.T) {
	a := newAPI(t)
	checking := a.account("Nubank", "asset", "checking")
	food := a.account("Food", "expense", "")

	a.mustDo(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", posting(checking, -12000), posting(food, 12000)), http.StatusCreated, nil)

	var bal struct {
		Balance struct {
			Amount   int64  `json:"amount"`
			Currency string `json:"currency"`
		} `json:"balance"`
	}
	a.mustDo(http.MethodGet, "/api/v1/accounts/"+checking+"/balance?date=2026-10-31", nil, http.StatusOK, &bal)
	if bal.Balance.Amount != -12000 || bal.Balance.Currency != "BRL" {
		t.Fatalf("balance = %+v", bal)
	}
}

func TestValidationErrorsHaveFields(t *testing.T) {
	a := newAPI(t)
	checking := a.account("Nubank", "asset", "checking")
	food := a.account("Food", "expense", "")

	a.expectProblem(a.do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", posting(checking, 0), posting(food, 0))),
		http.StatusUnprocessableEntity, "validation_failed", "postings[0].amount")
	a.expectProblem(a.do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", posting(checking, -9007199254740992), posting(food, 9007199254740992))),
		http.StatusUnprocessableEntity, "validation_failed", "postings[0].amount")
	a.expectProblem(a.do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", posting(checking, -100), posting(food, 90))),
		http.StatusUnprocessableEntity, "validation_failed", "postings")
}

func TestForeignAccountIs422(t *testing.T) {
	a := newAPI(t)
	checking := a.account("Nubank", "asset", "checking")
	otherClient := a.login("other@example.com")
	var other idOnly
	r := a.call(otherClient, http.MethodPost, "/api/v1/accounts", map[string]any{"name": "Food", "class": "expense", "currency": "BRL"})
	r.decode(t, &other)

	a.expectProblem(a.do(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", posting(checking, -100), posting(other.ID, 100))),
		http.StatusUnprocessableEntity, "invalid_account", "postings[1].account_id")
	a.expectProblem(a.do(http.MethodGet, "/api/v1/accounts/"+other.ID, nil), http.StatusNotFound, "not_found", "")
}

func TestCorrectionConflictIs409(t *testing.T) {
	a := newAPI(t)
	checking := a.account("Nubank", "asset", "checking")
	food := a.account("Food", "expense", "")
	var created idOnly
	a.mustDo(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", posting(checking, -100), posting(food, 100)), http.StatusCreated, &created)

	correction := tx("2026-10-14", posting(checking, -200), posting(food, 200))
	correction["expected_version"] = 1
	correction["reason"] = "typo"
	a.mustDo(http.MethodPut, "/api/v1/transactions/"+created.ID, correction, http.StatusOK, nil)
	a.expectProblem(a.do(http.MethodPut, "/api/v1/transactions/"+created.ID, correction), http.StatusConflict, "version_conflict", "")

	var versions struct {
		Items []struct {
			Version int `json:"version"`
		} `json:"items"`
	}
	a.mustDo(http.MethodGet, "/api/v1/transactions/"+created.ID+"/versions", nil, http.StatusOK, &versions)
	if len(versions.Items) != 1 || versions.Items[0].Version != 1 {
		t.Fatalf("versions = %+v", versions)
	}

	a.mustDo(http.MethodPost, "/api/v1/transactions/"+created.ID+"/void", map[string]string{"reason": "duplicate"}, http.StatusNoContent, nil)
	a.expectProblem(a.do(http.MethodPost, "/api/v1/transactions/"+created.ID+"/void", map[string]string{"reason": "again"}),
		http.StatusConflict, "transaction_voided", "")
}

func TestPaginationTies(t *testing.T) {
	a := newAPI(t)
	checking := a.account("Nubank", "asset", "checking")
	food := a.account("Food", "expense", "")
	for i := range 120 {
		a.mustDo(http.MethodPost, "/api/v1/transactions", tx(fmt.Sprintf("2026-10-%02d", 1+i%3), posting(checking, -1), posting(food, 1)), http.StatusCreated, nil)
	}

	seen := map[string]bool{}
	pages := 0
	path := "/api/v1/transactions?limit=50"
	for {
		var page struct {
			Items      []idOnly `json:"items"`
			NextCursor string   `json:"next_cursor"`
		}
		a.mustDo(http.MethodGet, path, nil, http.StatusOK, &page)
		pages++
		for _, it := range page.Items {
			if seen[it.ID] {
				t.Fatalf("transaction %s on two pages", it.ID)
			}
			seen[it.ID] = true
		}
		if page.NextCursor == "" {
			break
		}
		path = "/api/v1/transactions?limit=50&cursor=" + url.QueryEscape(page.NextCursor)
	}
	if pages != 3 || len(seen) != 120 {
		t.Fatalf("pages = %d, distinct = %d; want 3 and 120", pages, len(seen))
	}
}

func TestInvalidCursorIs400(t *testing.T) {
	a := newAPI(t)
	a.expectProblem(a.do(http.MethodGet, "/api/v1/transactions?cursor=abc", nil), http.StatusBadRequest, "invalid_request", "")
	a.expectProblem(a.do(http.MethodGet, "/api/v1/transactions?limit=500", nil), http.StatusBadRequest, "invalid_request", "")
}

func TestSettingsLockAfterFirstTransaction(t *testing.T) {
	a := newAPI(t)
	a.mustDo(http.MethodPut, "/api/v1/settings", map[string]string{"base_currency": "USD"}, http.StatusOK, nil)
	a.mustDo(http.MethodPut, "/api/v1/settings", map[string]string{"base_currency": "BRL"}, http.StatusOK, nil)
	checking := a.account("Nubank", "asset", "checking")
	food := a.account("Food", "expense", "")
	a.mustDo(http.MethodPost, "/api/v1/transactions", tx("2026-10-14", posting(checking, -100), posting(food, 100)), http.StatusCreated, nil)

	a.expectProblem(a.do(http.MethodPut, "/api/v1/settings", map[string]string{"base_currency": "USD"}), http.StatusConflict, "settings_locked", "")
}

func TestUnauthenticated(t *testing.T) {
	a := newAPI(t)
	anonymous := &http.Client{}
	for _, p := range []string{"/api/v1/accounts", "/api/v1/transactions", "/api/v1/settings", "/api/v1/payees", "/api/v1/institutions", "/api/v1/tags"} {
		if r := a.call(anonymous, http.MethodGet, p, nil); r.status != http.StatusUnauthorized {
			t.Errorf("GET %s without session = %d, want 401", p, r.status)
		}
	}
}
