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

func setupBody(token, email, region string) map[string]string {
	return map[string]string{"token": token, "email": email, "password": "correct horse battery", "language": "en", "region": region}
}

// W-U2: the setup is required until the first user exists.
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
		t.Fatalf("required = false before the first user: %s", r.Body)
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
		t.Fatal("required = true after the first user")
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
		t.Fatalf("user = %+v", u)
	}
	me := h.Call(c, http.MethodGet, "/api/v1/me", nil)
	if me.Status != http.StatusOK {
		t.Fatalf("GET /me with the setup cookie: status %d", me.Status)
	}
	h.Dispatch() // the ledger opens its settings from identity.user_created
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

// W-U3, W-U7: setup_complete after a setup, and after a user created by the CLI.
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
	created, conflicts := 0, 0
	for _, s := range statuses {
		switch s {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
			conflicts++
		}
	}
	if created != 1 || conflicts != 1 {
		t.Fatalf("statuses = %v, want one 201 and one 409", statuses)
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
