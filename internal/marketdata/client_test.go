package marketdata_test

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestFeedUserAgent(t *testing.T) {
	t.Parallel()

	var (
		mu     sync.Mutex
		agents []string
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		agents = append(agents, r.UserAgent())
		mu.Unlock()

		_, _ = w.Write([]byte(`{"value":[]}`))
	}))
	t.Cleanup(srv.Close)

	h := apitest.New(t, apitest.Today("2026-11-09"),
		apitest.PriceFeeds([]string{"bcb_ptax"}, map[string]string{"bcb_ptax": srv.URL}))
	h.App.Marketdata.TickFeeds(t.Context())

	mu.Lock()
	defer mu.Unlock()

	if len(agents) == 0 {
		t.Fatal("no request recorded")
	}

	for _, a := range agents {
		if a != "equori/dev" {
			t.Fatalf("User-Agent = %q, want equori/dev", a)
		}
	}
}
