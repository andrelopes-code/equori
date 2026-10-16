package pluggy

import (
	"bytes"
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	ErrUnauthorized = errors.New("pluggy rejected the credentials")
	ErrNotFound     = errors.New("pluggy resource not found")
)

const (
	requestTimeout = 30 * time.Second
	maxAttempts    = 3
	maxWait        = 60 * time.Second
	keyLifetime    = 2 * time.Hour
	keyMargin      = 10 * time.Minute
	pageSize       = "500"
	dateLayout     = "2006-01-02"
)

// Client calls the Pluggy API at one base URL only (N17).
type Client struct {
	base *url.URL
	hc   *http.Client
	now  func() time.Time
	// Sleep waits before a retry; tests replace it.
	Sleep func(ctx context.Context, d time.Duration) error
}

func NewClient(baseURL string, hc *http.Client, now func() time.Time) (*Client, error) {
	u, err := url.Parse(strings.TrimRight(baseURL, "/"))
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return nil, fmt.Errorf("pluggy base URL %q is not an http(s) URL", baseURL)
	}
	return &Client{base: u, hc: hc, now: now, Sleep: sleep}, nil
}

func sleep(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// Session holds an API key; it is valid for two hours from its creation.
type Session struct {
	c       *Client
	key     string
	expires time.Time
}

// Session creates an API key from the application credentials (POST /auth).
func (c *Client) Session(ctx context.Context, clientID, clientSecret string) (*Session, error) {
	body, err := json.Marshal(map[string]string{"clientId": clientID, "clientSecret": clientSecret})
	if err != nil {
		return nil, err
	}
	var out struct {
		APIKey string `json:"apiKey"`
	}
	if err := c.do(ctx, http.MethodPost, "POST /auth", c.base.String()+"/auth", "", body, &out); err != nil {
		return nil, err
	}
	if out.APIKey == "" {
		return nil, errors.New("pluggy POST /auth returned no API key")
	}
	return &Session{c: c, key: out.APIKey, expires: c.now().Add(keyLifetime)}, nil
}

// do sends one request, retrying 429 and 5xx responses. label names the endpoint in
// errors without identifiers (N16).
func (c *Client) do(ctx context.Context, method, label, target, apiKey string, body []byte, out any) error {
	var last error
	for attempt := range maxAttempts {
		status, retryAfter, payload, err := c.send(ctx, method, target, apiKey, body)
		switch {
		case err != nil:
			return fmt.Errorf("pluggy %s: %w", label, err)
		case status == http.StatusUnauthorized || status == http.StatusForbidden:
			return fmt.Errorf("pluggy %s: %w", label, ErrUnauthorized)
		case status == http.StatusNotFound:
			return fmt.Errorf("pluggy %s: %w", label, ErrNotFound)
		case status == http.StatusTooManyRequests || status >= 500:
			last = fmt.Errorf("pluggy %s: status %d", label, status)
			if attempt == maxAttempts-1 {
				break
			}
			wait := retryAfter
			if wait <= 0 {
				wait = time.Second << attempt
			}
			if err := c.Sleep(ctx, min(wait, maxWait)); err != nil {
				return err
			}
			continue
		case status >= 300:
			return fmt.Errorf("pluggy %s: status %d", label, status)
		default:
			if err := json.Unmarshal(payload, out); err != nil {
				return fmt.Errorf("pluggy %s: decode: %w", label, err)
			}
			return nil
		}
	}
	return last
}

func (c *Client) send(ctx context.Context, method, target, apiKey string, body []byte) (status int, retryAfter time.Duration, payload []byte, err error) {
	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, method, target, bytes.NewReader(body))
	if err != nil {
		return 0, 0, nil, err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if apiKey != "" {
		req.Header.Set("X-API-KEY", apiKey)
	}
	resp, err := c.hc.Do(req)
	if err != nil {
		return 0, 0, nil, err
	}
	defer resp.Body.Close()
	payload, err = io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if secs, convErr := strconv.Atoi(resp.Header.Get("Retry-After")); convErr == nil && secs > 0 {
		retryAfter = time.Duration(secs) * time.Second
	}
	return resp.StatusCode, retryAfter, payload, err
}

func (s *Session) get(ctx context.Context, label, path string, q url.Values, out any) error {
	target := s.c.base.String() + path
	if len(q) > 0 {
		target += "?" + q.Encode()
	}
	return s.c.do(ctx, http.MethodGet, label, target, s.key, nil, out)
}

func (s *Session) Item(ctx context.Context, id string) (Item, error) {
	var it Item
	err := s.get(ctx, "GET /items/{id}", "/items/"+url.PathEscape(id), nil, &it)
	return it, err
}

type page[T any] struct {
	Results    []T `json:"results"`
	Page       int `json:"page"`
	TotalPages int `json:"totalPages"`
}

func listAll[T any](ctx context.Context, s *Session, label, path string, q url.Values) ([]T, error) {
	var out []T
	q.Set("pageSize", pageSize)
	for n := 1; ; n++ {
		q.Set("page", strconv.Itoa(n))
		var p page[T]
		if err := s.get(ctx, label, path, q, &p); err != nil {
			return nil, err
		}
		out = append(out, p.Results...)
		if n >= p.TotalPages {
			return out, nil
		}
	}
}

func (s *Session) Accounts(ctx context.Context, itemID string) ([]Account, error) {
	return listAll[Account](ctx, s, "GET /accounts", "/accounts", url.Values{"itemId": {itemID}})
}

func (s *Session) Bills(ctx context.Context, accountID string) ([]Bill, error) {
	return listAll[Bill](ctx, s, "GET /bills", "/bills", url.Values{"accountId": {accountID}})
}

// Transactions returns the account's transactions dated in [from, to], following the
// cursor of GET /v2/transactions. A cursor is a query string; one that names a host is refused (N17).
func (s *Session) Transactions(ctx context.Context, accountID string, from, to time.Time) ([]Transaction, error) {
	const label, path = "GET /v2/transactions", "/v2/transactions"
	target := s.c.base.String() + path + "?" + url.Values{
		"accountId": {accountID}, "dateFrom": {from.Format(dateLayout)}, "dateTo": {to.Format(dateLayout)},
	}.Encode()
	var out []Transaction
	for {
		var p struct {
			Results []Transaction `json:"results"`
			Next    *string       `json:"next"`
		}
		if err := s.c.do(ctx, http.MethodGet, label, target, s.key, nil, &p); err != nil {
			return nil, err
		}
		out = append(out, p.Results...)
		if p.Next == nil || *p.Next == "" {
			return out, nil
		}
		if !strings.HasPrefix(*p.Next, "?") {
			return nil, fmt.Errorf("pluggy %s: cursor is not a query string", label)
		}
		target = s.c.base.String() + path + *p.Next
	}
}

// Sessions caches one session per integration and renews it 10 minutes before expiry.
type Sessions struct {
	c  *Client
	mu sync.Mutex
	m  map[string]*Session
}

func NewSessions(c *Client) *Sessions { return &Sessions{c: c, m: map[string]*Session{}} }

func (ss *Sessions) Get(ctx context.Context, key, clientID, clientSecret string) (*Session, error) {
	ss.mu.Lock()
	defer ss.mu.Unlock()
	if s, ok := ss.m[key]; ok && ss.c.now().Before(s.expires.Add(-keyMargin)) {
		return s, nil
	}
	s, err := ss.c.Session(ctx, clientID, clientSecret)
	if err != nil {
		delete(ss.m, key)
		return nil, err
	}
	ss.m[key] = s
	return s, nil
}

// Forget drops the cached session, after a credential change or a rejected key.
func (ss *Sessions) Forget(key string) {
	ss.mu.Lock()
	defer ss.mu.Unlock()
	delete(ss.m, key)
}
