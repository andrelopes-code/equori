package instance_test

import (
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const (
	versionPath     = "/api/v1/instance/version"
	updateCheckPath = "/api/v1/instance/version/update-check"
	releaseNotes    = "https://github.com/andrelopes-code/equori/releases/tag/v1.0.1"
	prereleaseNotes = "https://github.com/andrelopes-code/equori/releases/tag/v1.0.0-rc.2"
)

type versionStatus struct {
	Version     string `json:"version"`
	UpdateCheck *bool  `json:"update_check"`
	Latest      *struct {
		Version   string    `json:"version"`
		URL       string    `json:"url"`
		CheckedAt time.Time `json:"checked_at"`
	} `json:"latest"`
	Newer        bool   `json:"newer"`
	Distribution string `json:"distribution"`
}

// releaseStub answers like the GitHub releases endpoints and records what it receives: /latest
// holds v1.0.1, the list holds v1.0.0-rc.2 first.
type releaseStub struct {
	*httptest.Server

	mu       sync.Mutex
	requests int
	uri      string
	headers  http.Header
	status   int
}

func TestS220VersionCheck(t *testing.T) {
	t.Parallel()

	stub := newReleaseStub(t)
	h := apitest.New(t, apitest.Version("v1.0.0"), apitest.ReleaseURL(stub.URL))

	checkVersion(t, h)
	stub.wantRequests(t, 0)

	if got := putUpdateCheck(t, h, false); got.UpdateCheck == nil || *got.UpdateCheck {
		t.Fatalf("update_check = %v, want false", got.UpdateCheck)
	}

	checkVersion(t, h)
	stub.wantRequests(t, 0)

	putUpdateCheck(t, h, true)
	checkVersion(t, h)
	stub.wantRequests(t, 1)
	stub.wantURI(t, "/latest")

	if got := stub.header("User-Agent"); got != "equori" {
		t.Fatalf("User-Agent = %q, want equori", got)
	}

	if got := stub.header("Accept"); got != "application/vnd.github+json" {
		t.Fatalf("Accept = %q, want application/vnd.github+json", got)
	}

	for name := range stub.headerNames() {
		if !slices.Contains([]string{"User-Agent", "Accept", "Accept-Encoding"}, name) {
			t.Fatalf("request carries header %q", name)
		}
	}

	got := getVersion(t, h)
	if got.Version != "v1.0.0" || got.UpdateCheck == nil || !*got.UpdateCheck || !got.Newer {
		t.Fatalf("version status = %+v, want v1.0.0, update_check true, newer true", got)
	}

	if got.Latest == nil || got.Latest.Version != "v1.0.1" || got.Latest.URL != releaseNotes {
		t.Fatalf("latest = %+v, want v1.0.1 at %s", got.Latest, releaseNotes)
	}

	h.Restart(apitest.Version("dev"), apitest.ReleaseURL(stub.URL))
	checkVersion(t, h)
	stub.wantRequests(t, 1)
}

// S272 (A194.2): managed mode wins over the variable compose.yaml sets.
func TestS272Distribution(t *testing.T) {
	t.Parallel()

	tests := []struct {
		variable, mode, want string
	}{
		{variable: "compose", want: "compose"},
		{want: "other"},
		{mode: "managed", want: "managed"},
		{variable: "compose", mode: "managed", want: "managed"},
	}
	for _, tt := range tests {
		t.Run(tt.want+"/"+tt.variable, func(t *testing.T) {
			t.Parallel()

			h := apitest.New(t, apitest.Distribution(tt.variable, tt.mode))

			if got := getVersion(t, h).Distribution; got != tt.want {
				t.Fatalf("distribution = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestA159FailedCheckKeepsAnswer(t *testing.T) {
	t.Parallel()

	stub := newReleaseStub(t)
	h := apitest.New(t, apitest.Version("v1.0.0"), apitest.ReleaseURL(stub.URL))
	putUpdateCheck(t, h, true)
	checkVersion(t, h)

	stub.setStatus(http.StatusInternalServerError)

	if err := h.App.Instance.CheckVersion(t.Context()); err == nil {
		t.Fatal("CheckVersion error = nil, want an error")
	}

	if !strings.Contains(h.Logs(), "level=WARN") || !strings.Contains(h.Logs(), "version_check_failed") {
		t.Fatalf("logs hold no warn record with code version_check_failed:\n%s", h.Logs())
	}

	if got := getVersion(t, h); got.Latest == nil || got.Latest.Version != "v1.0.1" {
		t.Fatalf("latest = %+v, want v1.0.1", got.Latest)
	}
}

// A159.2: a pre-release binary reads the newest release of the list, pre-releases included.
func TestA159PrereleaseChannel(t *testing.T) {
	t.Parallel()

	stub := newReleaseStub(t)
	h := apitest.New(t, apitest.Version("v1.0.0-rc.1"), apitest.ReleaseURL(stub.URL))
	putUpdateCheck(t, h, true)

	checkVersion(t, h)

	stub.wantRequests(t, 1)
	stub.wantURI(t, "/?per_page=1")

	got := getVersion(t, h)
	if got.Latest == nil || got.Latest.Version != "v1.0.0-rc.2" || got.Latest.URL != prereleaseNotes {
		t.Fatalf("latest = %+v, want v1.0.0-rc.2 at %s", got.Latest, prereleaseNotes)
	}

	if !got.Newer {
		t.Fatal("newer = false, want true")
	}
}

func TestA159SetupStoresConsent(t *testing.T) {
	t.Parallel()

	t.Run("consent is stored", func(t *testing.T) {
		t.Parallel()

		h := apitest.Empty(t)
		client := setupClient(t)

		r := h.Call(client, http.MethodPost, "/api/v1/setup", setupBody(t, h, map[string]any{"update_check": true}))
		if r.Status != http.StatusCreated {
			t.Fatalf("setup: status = %d, want 201: %s", r.Status, r.Body)
		}

		r = h.Call(client, http.MethodGet, versionPath, nil)
		if r.Status != http.StatusOK {
			t.Fatalf("get version: status = %d, want 200: %s", r.Status, r.Body)
		}

		var got versionStatus
		r.Decode(t, &got)

		if got.UpdateCheck == nil || !*got.UpdateCheck {
			t.Fatalf("update_check = %v, want true", got.UpdateCheck)
		}
	})

	t.Run("a body without update_check is rejected", func(t *testing.T) {
		t.Parallel()

		h := apitest.Empty(t)

		r := h.Call(setupClient(t), http.MethodPost, "/api/v1/setup", setupBody(t, h, nil))
		if r.Status != http.StatusBadRequest {
			t.Fatalf("setup: status = %d, want 400: %s", r.Status, r.Body)
		}
	})
}

func newReleaseStub(t *testing.T) *releaseStub {
	t.Helper()

	s := &releaseStub{status: http.StatusOK}
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()

		s.requests++
		s.uri = r.URL.RequestURI()
		s.headers = r.Header.Clone()

		if s.status != http.StatusOK {
			w.WriteHeader(s.status)
			return
		}

		if r.URL.Path == "/latest" {
			_, _ = w.Write([]byte(`{"tag_name": "v1.0.1", "html_url": "` + releaseNotes + `"}`))
			return
		}

		_, _ = w.Write([]byte(`[{"tag_name": "v1.0.0-rc.2", "html_url": "` + prereleaseNotes + `"}]`))
	}))
	t.Cleanup(s.Close)

	return s
}

func (s *releaseStub) wantRequests(t *testing.T, want int) {
	t.Helper()

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.requests != want {
		t.Fatalf("release requests = %d, want %d", s.requests, want)
	}
}

func (s *releaseStub) wantURI(t *testing.T, want string) {
	t.Helper()

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.uri != want {
		t.Fatalf("release request URI = %q, want %q", s.uri, want)
	}
}

func (s *releaseStub) header(name string) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.headers.Get(name)
}

func (s *releaseStub) headerNames() map[string]bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	names := make(map[string]bool, len(s.headers))
	for name := range s.headers {
		names[name] = true
	}

	return names
}

func (s *releaseStub) setStatus(status int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.status = status
}

func checkVersion(t *testing.T, h *apitest.Harness) {
	t.Helper()

	if err := h.App.Instance.CheckVersion(t.Context()); err != nil {
		t.Fatal(err)
	}
}

func getVersion(t *testing.T, h *apitest.Harness) versionStatus {
	t.Helper()

	r := h.Do(http.MethodGet, versionPath, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("get version: status = %d, want 200: %s", r.Status, r.Body)
	}

	var got versionStatus
	r.Decode(t, &got)

	return got
}

func putUpdateCheck(t *testing.T, h *apitest.Harness, consent bool) versionStatus {
	t.Helper()

	r := h.Do(http.MethodPut, updateCheckPath, map[string]bool{"update_check": consent})
	if r.Status != http.StatusOK {
		t.Fatalf("set update check: status = %d, want 200: %s", r.Status, r.Body)
	}

	var got versionStatus
	r.Decode(t, &got)

	return got
}

func setupClient(t *testing.T) *http.Client {
	t.Helper()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}

	return &http.Client{Jar: jar}
}

// setupBody holds the fields of POST /setup; extra overrides or adds fields.
func setupBody(t *testing.T, h *apitest.Harness, extra map[string]any) map[string]any {
	t.Helper()

	token, err := h.App.Identity.StartSetup(t.Context())
	if err != nil || token == "" {
		t.Fatalf("StartSetup = %q, %v; want a token", token, err)
	}

	body := map[string]any{
		"token":         token,
		"email":         "ann@example.com",
		"password":      "correct horse battery",
		"language":      "en",
		"region":        locale.Regions()[0],
		"base_currency": "BRL",
	}
	for k, v := range extra {
		body[k] = v
	}

	return body
}
