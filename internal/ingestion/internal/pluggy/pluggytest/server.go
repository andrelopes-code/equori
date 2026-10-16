// Package pluggytest serves a fake Pluggy API for tests (P6 Global Constraints).
package pluggytest

import (
	"encoding/json/v2"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
)

// Server holds items, accounts, bills and transactions in memory.
type Server struct {
	srv *httptest.Server

	mu           sync.Mutex
	clientID     string
	secret       string
	keys         map[string]bool
	issued       int
	items        map[string]pluggy.Item
	accounts     map[string][]pluggy.Account
	transactions map[string][]pluggy.Transaction
	bills        map[string][]pluggy.Bill
	requests     map[string]int
	failStatus   int
	failCount    int
	next         string
	pageSize     int
}

func New(t testing.TB, clientID, secret string) *Server {
	s := &Server{
		clientID: clientID, secret: secret, keys: map[string]bool{}, items: map[string]pluggy.Item{},
		accounts: map[string][]pluggy.Account{}, transactions: map[string][]pluggy.Transaction{},
		bills: map[string][]pluggy.Bill{}, requests: map[string]int{}, pageSize: 500,
	}
	s.srv = httptest.NewServer(http.HandlerFunc(s.serve))
	t.Cleanup(s.srv.Close)
	return s
}

func (s *Server) URL() string              { return s.srv.URL }
func (s *Server) HTTPClient() *http.Client { return s.srv.Client() }

// SetCredentials replaces the application credentials the server accepts.
func (s *Server) SetCredentials(clientID, secret string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.clientID, s.secret = clientID, secret
}

// AddItem adds or replaces an item.
func (s *Server) AddItem(it pluggy.Item) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[it.ID] = it
}

func (s *Server) AddAccount(itemID string, a pluggy.Account) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.accounts[itemID] = append(s.accounts[itemID], a)
}

// SetAccountBalance changes an account's balance.
func (s *Server) SetAccountBalance(accountID string, balance pluggy.Decimal) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for item, as := range s.accounts {
		for i := range as {
			if as[i].ID == accountID {
				s.accounts[item][i].Balance = balance
			}
		}
	}
}

func (s *Server) AddBill(accountID string, b pluggy.Bill) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bills[accountID] = append(s.bills[accountID], b)
}

// AddTransaction adds a transaction, or replaces the one with the same id.
func (s *Server) AddTransaction(accountID string, t pluggy.Transaction) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ts := s.transactions[accountID]
	if i := slices.IndexFunc(ts, func(x pluggy.Transaction) bool { return x.ID == t.ID }); i >= 0 {
		ts[i] = t
		return
	}
	s.transactions[accountID] = append(ts, t)
}

// RemoveTransaction stops returning a transaction, as banks sometimes do.
func (s *Server) RemoveTransaction(accountID, id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.transactions[accountID] = slices.DeleteFunc(s.transactions[accountID], func(x pluggy.Transaction) bool { return x.ID == id })
}

// FailNext answers the next n requests with status; 429 carries Retry-After: 7.
func (s *Server) FailNext(status, n int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failStatus, s.failCount = status, n
}

// RevokeKeys invalidates every API key issued so far.
func (s *Server) RevokeKeys() {
	s.mu.Lock()
	defer s.mu.Unlock()
	clear(s.keys)
}

// SetNext makes the first transaction page return next as its cursor.
func (s *Server) SetNext(next string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.next = next
}

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
	if s.failCount > 0 {
		s.failCount--
		if s.failStatus == http.StatusTooManyRequests {
			w.Header().Set("Retry-After", "7")
		}
		w.WriteHeader(s.failStatus)
		return
	}
	if r.URL.Path == "/auth" && r.Method == http.MethodPost {
		var in struct {
			ClientID     string `json:"clientId"`
			ClientSecret string `json:"clientSecret"`
		}
		if err := json.UnmarshalRead(r.Body, &in); err != nil || in.ClientID != s.clientID || in.ClientSecret != s.secret {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		s.issued++
		key := "key-" + strconv.Itoa(s.issued)
		s.keys[key] = true
		write(w, map[string]string{"apiKey": key})
		return
	}
	if !s.keys[r.Header.Get("X-API-KEY")] {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	q := r.URL.Query()
	switch {
	case strings.HasPrefix(r.URL.Path, "/items/"):
		it, ok := s.items[strings.TrimPrefix(r.URL.Path, "/items/")]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		write(w, it)
	case r.URL.Path == "/accounts":
		write(w, map[string]any{"page": 1, "totalPages": 1, "results": nonNil(s.accounts[q.Get("itemId")])})
	case r.URL.Path == "/bills":
		write(w, map[string]any{"page": 1, "totalPages": 1, "results": nonNil(s.bills[q.Get("accountId")])})
	case r.URL.Path == "/v2/transactions":
		s.transactionPage(w, q)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func (s *Server) transactionPage(w http.ResponseWriter, q url.Values) {
	var match []pluggy.Transaction
	for _, t := range s.transactions[q.Get("accountId")] {
		day := t.Date[:min(10, len(t.Date))]
		if day >= q.Get("dateFrom") && day <= q.Get("dateTo") {
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
