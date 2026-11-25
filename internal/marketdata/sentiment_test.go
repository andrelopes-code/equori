package marketdata_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const (
	contributionPlanPath = "/api/v1/contribution-plan"
	sentimentPath        = "/api/v1/sentiment-indexes/crypto_fear_greed"
)

type sentimentAPI struct {
	ID      string  `json:"id"`
	Enabled bool    `json:"enabled"`
	Value   *int    `json:"value"`
	Date    *string `json:"date"`
	Since   *string `json:"since"`
	Days    int     `json:"days"`
	Counts  []int   `json:"counts"`
}

// fearGreedServer answers the values of 2026-11-23 to 2026-11-25 and keeps what it was asked.
type fearGreedServer struct {
	mu    sync.Mutex
	asked []string
	rows  []string
}

func (s *fearGreedServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.asked = append(s.asked, r.URL.String())

	_, _ = fmt.Fprintf(w, `{"data":[%s]}`, strings.Join(s.rows, ","))
}

func (s *fearGreedServer) requests() []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return append([]string{}, s.asked...)
}

// S733: the source of the index is asked only with the feed on and a criterion that reads it.
func TestS733SentimentOnDemand(t *testing.T) {
	t.Parallel()
	h, srv := sentimentHarness(t)

	h.App.Marketdata.TickFeeds(t.Context())
	expectAsked(t, srv)

	setSentimentFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())
	expectAsked(t, srv)

	setSentimentFeed(t, h, false)
	saveFearGreed(t, h, "25")
	h.App.Marketdata.TickFeeds(t.Context())
	expectAsked(t, srv)

	setSentimentFeed(t, h, true)
	h.App.Marketdata.TickFeeds(t.Context())
	expectAsked(t, srv, "/fng/?limit=0")

	h.App.Marketdata.TickFeeds(t.Context())
	expectAsked(t, srv, "/fng/?limit=0", "/fng/?limit=1")

	without := fearGreedPlan("25")
	without["classes"].([]any)[2] = map[string]any{
		"name":      "C",
		"target_bp": 2000,
		"members":   []any{map[string]any{"instrument": "QSTC3"}},
	}
	h.MustDo(http.MethodPut, contributionPlanPath, without, http.StatusOK, nil)
	h.App.Marketdata.TickFeeds(t.Context())
	expectAsked(t, srv, "/fng/?limit=0", "/fng/?limit=1")
}

// S734: the index answers yes up to the limit and no above it, for an asset without a company too;
// a value more than three days old does not answer, and neither does a source that is off.
func TestS734SentimentAnswers(t *testing.T) {
	t.Parallel()
	h, _ := sentimentHarness(t)

	expectFearGreed(t, saveFearGreed(t, h, "25"), "none", "index_off", false)

	setSentimentFeed(t, h, true)
	expectFearGreed(t, saveFearGreed(t, h, "25"), "none", "no_index", false)

	h.App.Marketdata.TickFeeds(t.Context())

	yes := expectFearGreed(t, saveFearGreed(t, h, "13"), "yes", "", false)
	if yes.FactDetails[0].Value != "13" || yes.FactDetails[0].Date != "2026-11-25" {
		t.Fatalf("detail = %+v", yes.FactDetails[0])
	}

	expectFearGreed(t, saveFearGreed(t, h, "12"), "no", "", true)

	if _, err := h.Pool.Exec(
		t.Context(),
		`DELETE FROM marketdata_sentiment WHERE date > '2026-11-21'`,
	); err != nil {
		t.Fatal(err)
	}

	if _, err := h.Pool.Exec(
		t.Context(),
		`INSERT INTO marketdata_sentiment VALUES ('crypto_fear_greed', '2026-11-21', 90, 'alternative_me')`,
	); err != nil {
		t.Fatal(err)
	}

	expectFearGreed(t, saveFearGreed(t, h, "12"), "none", "stale", false)
}

func TestSentimentIndex(t *testing.T) {
	t.Parallel()
	h, srv := sentimentHarness(t)

	var got sentimentAPI
	h.MustDo(http.MethodGet, sentimentPath, nil, http.StatusOK, &got)

	if got.Enabled || got.Value != nil || got.Date != nil || got.Since != nil || got.Days != 0 ||
		len(got.Counts) != 101 {
		t.Fatalf("empty index = %+v", got)
	}

	setSentimentFeed(t, h, true)
	saveFearGreed(t, h, "25")
	h.App.Marketdata.TickFeeds(t.Context())
	h.MustDo(http.MethodGet, sentimentPath, nil, http.StatusOK, &got)

	if !got.Enabled || *got.Value != 13 || *got.Date != "2026-11-25" ||
		*got.Since != "2026-11-23" || got.Days != 3 || got.Counts[11] != 2 || got.Counts[13] != 1 {
		t.Fatalf("index = %+v", got)
	}

	// A value of a day after today fails the fetch and stores nothing.
	srv.mu.Lock()
	srv.rows = append(srv.rows, fearGreedRow("50", 1795651200))
	srv.mu.Unlock()

	h.App.Marketdata.TickFeeds(t.Context())
	h.MustDo(http.MethodGet, sentimentPath, nil, http.StatusOK, &got)

	if got.Days != 3 {
		t.Fatalf("days after a value of the future = %d", got.Days)
	}

	h.ExpectProblem(
		h.Do(http.MethodGet, "/api/v1/sentiment-indexes/unknown", nil),
		http.StatusNotFound,
		"not_found",
		"",
	)

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	if res := h.Call(reader, http.MethodGet, sentimentPath, nil); res.Status != http.StatusOK {
		t.Fatalf("reader: %d %s", res.Status, res.Body)
	}

	h.ExpectProblem(
		h.Call(&http.Client{}, http.MethodGet, sentimentPath, nil),
		http.StatusUnauthorized,
		"unauthenticated",
		"",
	)
}

// S736: a book of another region and base currency reads the same answer and the same split.
func TestS736SentimentOutsideBrazil(t *testing.T) {
	t.Parallel()
	h, _ := sentimentHarness(t)
	usd := h.LoginAs("usd@example.com", locale.Locale{Language: "en", Region: "US"}, "USD")

	setSentimentFeed(t, h, true)

	if res := h.Call(usd, http.MethodPut, contributionPlanPath, fearGreedPlan("12")); res.Status !=
		http.StatusOK {
		t.Fatalf("save: %d %s", res.Status, res.Body)
	}

	h.App.Marketdata.TickFeeds(t.Context())

	var got struct {
		Classes []struct {
			Amount *struct {
				Amount   int64  `json:"amount"`
				Currency string `json:"currency"`
			} `json:"amount"`
			Members []fearGreedMember `json:"members"`
		} `json:"classes"`
	}

	body := fearGreedPlan("12")
	body["amount"] = map[string]any{"amount": 100000, "currency": "USD"}

	res := h.Call(usd, http.MethodPost, contributionPlanPath+"/preview", body)
	if res.Status != http.StatusOK {
		t.Fatalf("preview: %d %s", res.Status, res.Body)
	}

	res.Decode(t, &got)

	for i, want := range []int64{62500, 37500, 0} {
		if a := got.Classes[i].Amount; a == nil || a.Amount != want || a.Currency != "USD" {
			t.Fatalf("class %d amount = %+v, want %d", i, a, want)
		}
	}

	expectFearGreed(t, got.Classes[2].Members[0], "no", "", true)
}

type fearGreedMember struct {
	FactAnswers []string `json:"fact_answers"`
	FactDetails []struct {
		Value  string `json:"value"`
		Reason string `json:"reason"`
		Date   string `json:"date"`
	} `json:"fact_details"`
	Held bool `json:"held"`
}

func sentimentHarness(t *testing.T) (*apitest.Harness, *fearGreedServer) {
	t.Helper()

	handler := &fearGreedServer{rows: []string{
		fearGreedRow("13", 1795564800),
		fearGreedRow("11", 1795478400),
		fearGreedRow("11", 1795392000),
	}}
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	h := apitest.New(
		t,
		apitest.Today("2026-11-25"),
		apitest.IndexFeeds(nil, map[string]string{"alternative_me": srv.URL}),
	)

	for _, code := range []string{"QSTA3", "QSTB3", "QSTC3"} {
		h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
			"code":           code,
			"type":           "stock",
			"name":           code,
			"scale":          0,
			"quote_currency": "USD",
		}, http.StatusCreated, nil)
	}

	return h, handler
}

func fearGreedRow(value string, timestamp int64) string {
	return fmt.Sprintf(`{"value":%q,"timestamp":"%d"}`, value, timestamp)
}

func setSentimentFeed(t *testing.T, h *apitest.Harness, enabled bool) {
	t.Helper()

	h.MustDo(
		http.MethodPut,
		"/api/v1/market-data/feeds/alternative_me",
		map[string]bool{"enabled": enabled},
		http.StatusOK,
		nil,
	)
}

// fearGreedPlan is three groups of 5000, 3000 and 2000, the last held by the index above limit.
func fearGreedPlan(limit string) map[string]any {
	group := func(name, code string, bp int) map[string]any {
		return map[string]any{
			"name":      name,
			"target_bp": bp,
			"members":   []any{map[string]any{"instrument": code}},
		}
	}

	last := group("C", "QSTC3", 2000)
	last["questions"] = []string{"Crypto Fear & Greed"}
	last["question_facts"] = []string{"crypto_fear_greed_max"}
	last["question_limits"] = []string{limit}
	last["question_effects"] = []string{"hold"}
	last["members"] = []any{map[string]any{"instrument": "QSTC3", "answers": []any{nil}}}

	return map[string]any{
		"classes": []any{group("A", "QSTA3", 5000), group("B", "QSTB3", 3000), last},
	}
}

func saveFearGreed(t *testing.T, h *apitest.Harness, limit string) fearGreedMember {
	t.Helper()

	var got struct {
		Classes []struct {
			Members []fearGreedMember `json:"members"`
		} `json:"classes"`
	}
	h.MustDo(http.MethodPut, contributionPlanPath, fearGreedPlan(limit), http.StatusOK, &got)

	return got.Classes[2].Members[0]
}

func expectFearGreed(
	t *testing.T,
	m fearGreedMember,
	answer, reason string,
	held bool,
) fearGreedMember {
	t.Helper()

	if len(m.FactAnswers) != 1 || m.FactAnswers[0] != answer || m.FactDetails[0].Reason != reason ||
		m.Held != held {
		t.Fatalf("member = %+v, want %s %q held %v", m, answer, reason, held)
	}

	return m
}

func expectAsked(t *testing.T, srv *fearGreedServer, want ...string) {
	t.Helper()

	if got := srv.requests(); fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("asked %v, want %v", got, want)
	}
}
