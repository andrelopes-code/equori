package instance_test

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const (
	versionPath     = "/api/v1/instance/version"
	updateCheckPath = "/api/v1/instance/version/update-check"
	releaseNotes    = "https://github.com/andrelopes-code/equori/releases/tag/v1.0.1"
)

type versionStatus struct {
	Version     string `json:"version"`
	UpdateCheck *bool  `json:"update_check"`
	Latest      *struct {
		Version   string    `json:"version"`
		URL       string    `json:"url"`
		CheckedAt time.Time `json:"checked_at"`
	} `json:"latest"`
	Newer bool `json:"newer"`
}

// releaseStub answers like the GitHub latest-release endpoint and records what it receives.
type releaseStub struct {
	*httptest.Server

	mu       sync.Mutex
	requests int
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

func newReleaseStub(t *testing.T) *releaseStub {
	t.Helper()

	s := &releaseStub{status: http.StatusOK}
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()

		s.requests++
		s.headers = r.Header.Clone()

		if s.status != http.StatusOK {
			w.WriteHeader(s.status)
			return
		}

		_, _ = w.Write([]byte(`{"tag_name": "v1.0.1", "html_url": "` + releaseNotes + `"}`))
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
