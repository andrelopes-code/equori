package identity_test

import (
	"net/http"
	"net/http/cookiejar"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/identity"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

func jarClient(t *testing.T) *http.Client {
	t.Helper()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}

	return &http.Client{Jar: jar}
}

// regions returns a region whose ledger has a default base currency and one without; the tests
// read them from the extension point instead of naming a country.
func regions(t *testing.T) (withDefault, without string) {
	t.Helper()

	for _, r := range locale.Regions() {
		if _, ok := ledger.DefaultBaseCurrency(r); ok {
			if withDefault == "" {
				withDefault = r
			}
		} else if without == "" {
			without = r
		}
	}

	if withDefault == "" || without == "" {
		t.Fatal("the ledger has no region with a default base currency and one without")
	}

	return withDefault, without
}

func startSetup(t *testing.T, h *apitest.Harness) string {
	t.Helper()

	token, err := h.App.Identity.StartSetup(t.Context())
	if err != nil || token == "" {
		t.Fatalf("StartSetup = %q, %v; want a token", token, err)
	}

	return token
}

func setupBody(token, email, region string) map[string]any {
	return map[string]any{"token": token, "email": email, "password": "correct horse battery", "language": "en", "region": region, "update_check": false}
}

// W-U2: the setup is required until the first member exists.
func TestSetupRequiredUntilTheFirstUser(t *testing.T) {
	h := apitest.Empty(t)
	c := jarClient(t)
	var st struct {
		Required bool `json:"required"`
	}

	r := h.Call(c, http.MethodGet, "/api/v1/setup", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &st)

	if !st.Required {
		t.Fatalf("required = false before the first member: %s", r.Body)
	}

	withDefault, _ := regions(t)
	if r := h.Call(c, http.MethodPost, "/api/v1/setup", setupBody(startSetup(t, h), "ann@example.com", withDefault)); r.Status != http.StatusCreated {
		t.Fatalf("setup status %d: %s", r.Status, r.Body)
	}

	r = h.Call(c, http.MethodGet, "/api/v1/setup", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &st)

	if st.Required {
		t.Fatal("required = true after the first member")
	}
}

// W-U3: the setup creates an admin, signs it in, and applies the region's default currency.
func TestSetupCreatesTheAdmin(t *testing.T) {
	h := apitest.Empty(t)
	c := jarClient(t)
	withDefault, _ := regions(t)

	r := h.Call(c, http.MethodPost, "/api/v1/setup", setupBody(startSetup(t, h), "ann@example.com", withDefault))
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	var u struct {
		Email    string `json:"email"`
		Role     string `json:"role"`
		Language string `json:"language"`
		Region   string `json:"region"`
	}
	r.Decode(t, &u)

	if u.Email != "ann@example.com" || u.Role != identity.RoleAdmin || u.Language != "en" || u.Region != withDefault {
		t.Fatalf("member = %+v", u)
	}

	me := h.Call(c, http.MethodGet, "/api/v1/me", nil)
	if me.Status != http.StatusOK {
		t.Fatalf("GET /me with the setup cookie: status %d", me.Status)
	}

	h.Dispatch() // the ledger opens its settings from identity.books_created

	settings := h.Call(c, http.MethodGet, "/api/v1/settings", nil)
	if settings.Status != http.StatusOK {
		t.Fatalf("GET /settings: status %d", settings.Status)
	}

	var s struct {
		BaseCurrency string `json:"base_currency"`
	}
	settings.Decode(t, &s)

	if want, _ := ledger.DefaultBaseCurrency(withDefault); s.BaseCurrency != string(want) {
		t.Fatalf("base currency = %q, want %q", s.BaseCurrency, want)
	}
}

// W-U3: setup_token_invalid.
func TestSetupRejectsAnotherToken(t *testing.T) {
	h := apitest.Empty(t)
	startSetup(t, h)
	withDefault, _ := regions(t)
	r := h.Call(jarClient(t), http.MethodPost, "/api/v1/setup", setupBody("not-the-token", "ann@example.com", withDefault))
	h.ExpectProblem(r, http.StatusForbidden, "setup_token_invalid", "")
}

// W-U3, W-U7: setup_complete after a setup, and after a member created by the CLI.
func TestSetupClosesAfterTheFirstUser(t *testing.T) {
	h := apitest.Empty(t)
	token := startSetup(t, h)

	withDefault, _ := regions(t)
	if r := h.Call(jarClient(t), http.MethodPost, "/api/v1/setup", setupBody(token, "ann@example.com", withDefault)); r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	r := h.Call(jarClient(t), http.MethodPost, "/api/v1/setup", setupBody(token, "bob@example.com", withDefault))
	h.ExpectProblem(r, http.StatusConflict, "setup_complete", "")

	cli := apitest.Empty(t)
	token = startSetup(t, cli)
	cli.Login("owner@example.com")
	r = cli.Call(jarClient(t), http.MethodPost, "/api/v1/setup", setupBody(token, "bob@example.com", withDefault))
	cli.ExpectProblem(r, http.StatusConflict, "setup_complete", "")
}

// W-U4: of two concurrent valid requests, one creates the admin and the other is refused.
func TestSetupConcurrentRequests(t *testing.T) {
	h := apitest.Empty(t)
	token := startSetup(t, h)
	withDefault, _ := regions(t)
	statuses := make([]int, 2)

	var wg sync.WaitGroup
	for i, email := range []string{"ann@example.com", "bob@example.com"} {
		wg.Go(func() {
			statuses[i] = h.Call(jarClient(t), http.MethodPost, "/api/v1/setup", setupBody(token, email, withDefault)).Status
		})
	}

	wg.Wait()

	// The request that loses either meets the member of the winner (409 setup_complete) or finds
	// the setup token already spent (403 setup_token_invalid), by when it reads the token.
	created, refused := 0, 0
	for _, s := range statuses {
		switch s {
		case http.StatusCreated:
			created++
		case http.StatusConflict, http.StatusForbidden:
			refused++
		}
	}

	if created != 1 || refused != 1 {
		t.Fatalf("statuses = %v, want one 201 and one 409 or 403", statuses)
	}

	var members int
	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM identity_member`).Scan(&members); err != nil || members != 1 {
		t.Fatalf("members = %d, %v; want 1", members, err)
	}
}

// W-U3: validation_failed on region, and on base_currency for a region without a default.
func TestSetupValidation(t *testing.T) {
	h := apitest.Empty(t)
	token := startSetup(t, h)
	r := h.Call(jarClient(t), http.MethodPost, "/api/v1/setup", setupBody(token, "ann@example.com", "ZZ"))
	h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "region")

	_, without := regions(t)
	r = h.Call(jarClient(t), http.MethodPost, "/api/v1/setup", setupBody(token, "ann@example.com", without))
	h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "base_currency")
}

// S231: the setup names the first book and sets its time zone; a zone equal to the region's
// default is stored as null.
func TestS231SetupNamesTheBook(t *testing.T) {
	tests := []struct {
		name       string
		fields     map[string]any
		status     int
		code       string
		field      string
		wantBooks  map[string]any
		wantNoUser bool
	}{
		{
			name:      "named, own zone",
			fields:    map[string]any{"books_name": "Casa", "time_zone": "America/Manaus"},
			status:    http.StatusCreated,
			wantBooks: map[string]any{"name": "Casa", "time_zone": "America/Manaus", "default_time_zone": "America/Sao_Paulo"},
		},
		{
			name:      "region default zone",
			fields:    map[string]any{"time_zone": "America/Sao_Paulo"},
			status:    http.StatusCreated,
			wantBooks: map[string]any{"name": "ann@example.com", "time_zone": nil, "default_time_zone": "America/Sao_Paulo"},
		},
		{
			name:      "trimmed name",
			fields:    map[string]any{"books_name": "  Casa  "},
			status:    http.StatusCreated,
			wantBooks: map[string]any{"name": "Casa", "time_zone": nil, "default_time_zone": "America/Sao_Paulo"},
		},
		{
			name:       "unknown zone",
			fields:     map[string]any{"time_zone": "Mars/Base"},
			status:     http.StatusUnprocessableEntity,
			code:       "time_zone_invalid",
			wantNoUser: true,
		},
		{
			name:       "blank name",
			fields:     map[string]any{"books_name": "   "},
			status:     http.StatusUnprocessableEntity,
			code:       "validation_failed",
			field:      "books_name",
			wantNoUser: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := apitest.Empty(t)
			c := jarClient(t)
			body := setupBody(startSetup(t, h), "ann@example.com", "BR")
			body["base_currency"] = "BRL"

			for k, v := range tt.fields {
				body[k] = v
			}

			r := h.Call(c, http.MethodPost, "/api/v1/setup", body)
			if tt.status != http.StatusCreated {
				h.ExpectProblem(r, tt.status, tt.code, tt.field)
			} else if r.Status != tt.status {
				t.Fatalf("status %d: %s", r.Status, r.Body)
			}

			if tt.wantNoUser {
				var st struct {
					Required bool `json:"required"`
				}

				got := h.Call(c, http.MethodGet, "/api/v1/setup", nil)
				if got.Status != http.StatusOK {
					t.Fatalf("GET /setup status %d: %s", got.Status, got.Body)
				}

				got.Decode(t, &st)

				if !st.Required {
					t.Fatalf("required = false after a rejected setup: %s", got.Body)
				}

				return
			}

			got := h.Call(c, http.MethodGet, "/api/v1/books/current", nil)
			if got.Status != http.StatusOK {
				t.Fatalf("GET /books/current status %d: %s", got.Status, got.Body)
			}

			var books struct {
				Name            string  `json:"name"`
				TimeZone        *string `json:"time_zone"`
				DefaultTimeZone string  `json:"default_time_zone"`
			}
			got.Decode(t, &books)

			if books.Name != tt.wantBooks["name"] || books.DefaultTimeZone != tt.wantBooks["default_time_zone"] {
				t.Fatalf("books = %+v, want %v", books, tt.wantBooks)
			}

			if want, _ := tt.wantBooks["time_zone"].(string); (books.TimeZone == nil) != (tt.wantBooks["time_zone"] == nil) ||
				(books.TimeZone != nil && *books.TimeZone != want) {
				t.Fatalf("time_zone = %v, want %v", books.TimeZone, tt.wantBooks["time_zone"])
			}
		})
	}
}
