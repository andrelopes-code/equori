// Package pluggytest serves a fake Pluggy API for tests (P6 Global Constraints).
package pluggytest

import (
	"encoding/json/v2"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
)

// Server holds applications, items, accounts, bills and transactions in memory. An
// application sees only its own items, as in Pluggy.
type Server struct {
	srv *httptest.Server

	mu           sync.Mutex
	first        string
	secrets      map[string]string // client id → secret
	keys         map[string]string // API key → client id
	issued       int
	items        map[string]client.Item
	owners       map[string]string // item id → client id
	accounts     map[string][]client.Account
	transactions map[string][]client.Transaction
	bills        map[string][]client.Bill
	investments  map[string][]client.Investment
	movements    map[string][]client.InvestmentTransaction
	requests     map[string]int
	failStatus   int
	failCount    int
	failing      map[string]int // account id → status of its transaction requests
	failInvest   int
	failMoves    map[string]int // investment id → status of its movement requests
	next         string
	pageSize     int
}

func New(t testing.TB, clientID, secret string) *Server {
	s := &Server{
		first:        clientID,
		secrets:      map[string]string{clientID: secret},
		keys:         map[string]string{},
		items:        map[string]client.Item{},
		owners:       map[string]string{},
		accounts:     map[string][]client.Account{},
		transactions: map[string][]client.Transaction{},
		bills:        map[string][]client.Bill{},
		investments:  map[string][]client.Investment{},
		movements:    map[string][]client.InvestmentTransaction{},
		failMoves:    map[string]int{},
		requests:     map[string]int{},
		failing:      map[string]int{},
		pageSize:     500,
	}
	s.srv = httptest.NewServer(http.HandlerFunc(s.serve))
	t.Cleanup(s.srv.Close)

	return s
}

func (s *Server) URL() string              { return s.srv.URL }
func (s *Server) HTTPClient() *http.Client { return s.srv.Client() }

// Requests counts the requests to a path.
func (s *Server) Requests(path string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.requests[path]
}

func (s *Server) serve(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.requests[r.URL.Path]++
	if s.failIfScheduled(w) {
		return
	}

	app, ok := s.authenticate(w, r)
	if !ok {
		return
	}

	s.route(w, r, app)
}

// failIfScheduled answers a scheduled failure and reports whether it did.
func (s *Server) failIfScheduled(w http.ResponseWriter) bool {
	if s.failCount == 0 {
		return false
	}

	s.failCount--
	if s.failStatus == http.StatusTooManyRequests {
		w.Header().Set("Retry-After", "7")
	}

	w.WriteHeader(s.failStatus)

	return true
}

// authenticate issues an API key for POST /auth and resolves the application of any other
// request; ok is false once the response is written.
func (s *Server) authenticate(w http.ResponseWriter, r *http.Request) (app string, ok bool) {
	if r.URL.Path == "/auth" && r.Method == http.MethodPost {
		var in struct {
			ClientID     string `json:"clientId"`
			ClientSecret string `json:"clientSecret"`
		}
		if err := json.UnmarshalRead(
			r.Body,
			&in,
		); err != nil || in.ClientSecret == "" ||
			s.secrets[in.ClientID] != in.ClientSecret {
			w.WriteHeader(http.StatusUnauthorized)
			return "", false
		}

		s.issued++
		key := "key-" + strconv.Itoa(s.issued)
		s.keys[key] = in.ClientID
		write(w, map[string]string{"apiKey": key})

		return "", false
	}

	app, ok = s.keys[r.Header.Get("X-API-KEY")]
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
	}

	return app, ok
}

// route answers an authenticated request of application app.
func (s *Server) route(w http.ResponseWriter, r *http.Request, app string) {
	q := r.URL.Query()
	switch {
	case strings.HasPrefix(r.URL.Path, "/items/"):
		id := strings.TrimPrefix(r.URL.Path, "/items/")

		it, ok := s.items[id]
		if !ok || s.owners[id] != app {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		write(w, it)
	case r.URL.Path == "/connect_token" && r.Method == http.MethodPost:
		write(w, map[string]string{"accessToken": "connect-" + app})
	case r.URL.Path == "/accounts":
		write(
			w,
			map[string]any{
				"page":       1,
				"totalPages": 1,
				"results":    nonNil(s.accounts[q.Get("itemId")]),
			},
		)
	case r.URL.Path == "/bills":
		write(
			w,
			map[string]any{
				"page":       1,
				"totalPages": 1,
				"results":    nonNil(s.bills[q.Get("accountId")]),
			},
		)
	case r.URL.Path == "/v2/transactions":
		s.transactionPage(w, q)
	case r.URL.Path == "/investments":
		cursorPage(s, w, q, s.failInvest, s.investments[q.Get("itemId")])
	case strings.HasPrefix(r.URL.Path, "/investments/"):
		id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/investments/"), "/transactions")
		cursorPage(s, w, q, s.failMoves[id], s.movements[id])
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

// cursorPage answers a listing in the results and next shape, or status when it is not 0.
func cursorPage[T any](s *Server, w http.ResponseWriter, q url.Values, status int, all []T) {
	if status != 0 {
		w.WriteHeader(status)
		return
	}

	start, _ := strconv.Atoi(q.Get("after"))
	end := min(start+s.pageSize, len(all))

	var next *string
	if end < len(all) {
		v := q
		v.Set("after", strconv.Itoa(end))
		n := "?" + v.Encode()
		next = &n
	}

	write(w, map[string]any{"results": nonNil(all[start:end]), "next": next})
}

func (s *Server) transactionPage(w http.ResponseWriter, q url.Values) {
	if status := s.failing[q.Get("accountId")]; status != 0 {
		w.WriteHeader(status)
		return
	}

	var match []client.Transaction
	for _, t := range s.transactions[q.Get("accountId")] {
		if matches(t, q) {
			match = append(match, t)
		}
	}

	start, _ := strconv.Atoi(q.Get("after"))
	end := min(start+s.pageSize, len(match))

	var next *string
	if end < len(match) {
		v := q
		v.Set("after", strconv.Itoa(end))
		n := "?" + v.Encode()
		next = &n
	}

	if s.next != "" && start == 0 {
		next = &s.next
	}

	write(w, map[string]any{"results": nonNil(match[start:end]), "next": next})
}

// matches applies createdAtFrom when given, else dateFrom and dateTo.
func matches(t client.Transaction, q url.Values) bool {
	if since := q.Get("createdAtFrom"); since != "" {
		from, err := time.Parse(time.RFC3339Nano, since)
		if err != nil || t.CreatedAt == "" {
			return false
		}

		created, err := time.Parse(time.RFC3339Nano, t.CreatedAt)

		return err == nil && !created.Before(from)
	}

	day := t.Date[:min(10, len(t.Date))]

	return day >= q.Get("dateFrom") && day <= q.Get("dateTo")
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}

	return s
}

func write(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")

	if err := json.MarshalWrite(w, v); err != nil {
		panic(fmt.Sprintf("pluggytest: encode: %v", err))
	}
}
