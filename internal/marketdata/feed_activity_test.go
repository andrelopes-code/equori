package marketdata_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// slowServer answers the SGS of s and holds every other request until release is closed; it tells the
// path of each held request.
func slowServer(t *testing.T, s *sgsServer) (*httptest.Server, chan string, chan struct{}) {
	t.Helper()

	held := make(chan string, 100)
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/dados/") {
			s.ServeHTTP(w, r)
			return
		}

		held <- r.URL.Path

		select {
		case <-release:
		case <-r.Context().Done():
		}

		_, _ = fmt.Fprint(w, `{"value":[]}`)
	}))
	t.Cleanup(srv.Close)

	return srv, held, release
}

// runFeeds runs the loop of the feeds until the test ends.
func runFeeds(t *testing.T, h *apitest.Harness) {
	t.Helper()

	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan struct{})

	go func() {
		h.App.Marketdata.RunFeeds(ctx, time.Hour)
		close(done)
	}()

	t.Cleanup(func() {
		cancel()
		<-done
	})
}

// eventually waits until ok holds, up to 20 seconds.
func eventually(t *testing.T, what string, ok func() bool) {
	t.Helper()

	for range 400 {
		if ok() {
			return
		}

		time.Sleep(50 * time.Millisecond)
	}

	t.Fatalf("%s did not happen", what)
}

// S712: an index enabled while a price source downloads runs at once, without waiting for the end of
// the tick, and each feed states what it does (A267 FA1 to FA3).
func TestS712EnabledFeedRunsAtOnce(t *testing.T) {
	t.Parallel()

	srv, held, release := slowServer(t, &sgsServer{cdi: cdiWeek})
	urls := indexURLs(srv)
	urls["bcb_ptax"] = srv.URL + "/ptax"

	h := apitest.New(
		t,
		apitest.Today("2026-01-09"),
		apitest.PriceFeeds([]string{"bcb_ptax"}, urls),
	)
	execSQL(t, h, `INSERT INTO marketdata_feed (id, enabled) VALUES
		('bcb_ptax', true), ('ecb', false)`)

	runFeeds(t, h)

	select {
	case <-held:
	case <-time.After(20 * time.Second):
		t.Fatal("the price source was not asked")
	}

	if f := feedsOf(t, h)["bcb_ptax"]; f.Activity != "running" {
		t.Errorf("bcb_ptax = %+v, want running", f)
	}

	var enabled feedAPI
	h.MustDo(http.MethodPut, "/api/v1/market-data/feeds/br_cdi",
		map[string]any{"enabled": true}, http.StatusOK, &enabled)

	if enabled.Activity == "idle" && enabled.Last == nil {
		t.Errorf("br_cdi just enabled = %+v, want queued or running", enabled)
	}

	eventually(t, "the load of the CDI", func() bool {
		f := feedsOf(t, h)["br_cdi"]

		return f.Last != nil && *f.Last == "2026-01-09" && f.Activity == "idle"
	})

	if f := feedsOf(t, h)["bcb_ptax"]; f.Activity != "running" {
		t.Errorf("bcb_ptax = %+v, want still running", f)
	}

	close(release)

	eventually(t, "the end of the tick", func() bool {
		return feedsOf(t, h)["bcb_ptax"].Activity == "idle"
	})
}

// S712: the feeds behind the running one are queued, the indexes run before the price sources, and a
// disabled feed is idle (FA1, FA2).
func TestS712QueuedFeeds(t *testing.T) {
	t.Parallel()

	release := make(chan struct{})
	asked := make(chan string, 100)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked <- r.URL.Path

		select {
		case <-release:
		case <-r.Context().Done():
		}

		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)

	urls := indexURLs(srv)
	urls["bcb_ptax"] = srv.URL + "/ptax"

	h := apitest.New(t, apitest.Today("2026-01-09"), apitest.PriceFeeds(nil, urls))
	execSQL(t, h, `INSERT INTO marketdata_feed (id, enabled) VALUES
		('bcb_ptax', true), ('br_cdi', true), ('br_selic', false)`)

	runFeeds(t, h)

	select {
	case path := <-asked:
		if !strings.HasPrefix(path, "/dados/") {
			t.Errorf("first request = %s, want the one of the index", path)
		}
	case <-time.After(20 * time.Second):
		t.Fatal("no feed was asked")
	}

	fs := feedsOf(t, h)
	if fs["br_cdi"].Activity != "running" || fs["bcb_ptax"].Activity != "queued" ||
		fs["br_selic"].Activity != "idle" {
		t.Errorf("activities = cdi %s, ptax %s, selic %s, want running, queued and idle",
			fs["br_cdi"].Activity, fs["bcb_ptax"].Activity, fs["br_selic"].Activity)
	}

	close(release)
}
