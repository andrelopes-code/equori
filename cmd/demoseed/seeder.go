package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// seeder drives the HTTP API of a running application. The first failure is kept in err and turns every later call into a no-op, so the data tables read as straight lines.
type seeder struct {
	ctx   context.Context
	base  string
	http  *http.Client
	err   error
	ids   map[string]string
	calls int

	// Simulation state of the generated history.
	rng     *rand.Rand
	start   time.Time
	today   time.Time
	bal     map[string]int64 // running balance by account id, to fund accounts before they overdraw
	px      map[string][]float64
	hold    map[string]int64 // units held by security code
	snap    map[string]map[string]int64
	entries []entry
	events  []event
}

// event is one action of the history at a date; events run in date order, ties in insertion order.
type event struct {
	date time.Time
	run  func()
}

func newSeeder(ctx context.Context, base string, c *http.Client) *seeder {
	return &seeder{
		ctx: ctx, base: strings.TrimRight(base, "/"), http: c, ids: map[string]string{},
		rng: rand.New(rand.NewPCG(20241001, 7)), //nolint:gosec // a fixed seed makes the generated history reproducible.
		bal: map[string]int64{}, px: map[string][]float64{}, hold: map[string]int64{}, snap: map[string]map[string]int64{},
	}
}

func (s *seeder) fail(format string, args ...any) {
	if s.err == nil {
		s.err = fmt.Errorf(format, args...)
	}
}

// tolerate clears a failure that carries the problem code, for a call that is meant to be refused.
func (s *seeder) tolerate(code string) {
	if s.err != nil && strings.Contains(s.err.Error(), `"code":"`+code+`"`) {
		s.err = nil
	}
}

// do sends one JSON request and decodes a 2xx response into out when out is not nil.
func (s *seeder) do(method, path string, body, out any) {
	if s.err != nil {
		return
	}
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			s.fail("encode %s %s: %w", method, path, err)
			return
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(s.ctx, method, s.base+"/api/v1"+path, reader)
	if err != nil {
		s.fail("build %s %s: %w", method, path, err)
		return
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := s.http.Do(req) //nolint:gosec // the address is the operator's own instance.
	if err != nil {
		s.fail("%s %s: %w", method, path, err)
		return
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		s.fail("read %s %s: %w", method, path, err)
		return
	}
	s.calls++
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		s.fail("%s %s: status %d: %s", method, path, resp.StatusCode, truncate(raw))
		return
	}
	if out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, out); err != nil {
			s.fail("decode %s %s: %w", method, path, err)
		}
	}
}

func truncate(b []byte) string {
	if len(b) > 400 {
		return string(b[:400]) + "..."
	}
	return string(b)
}

// create posts body and returns the id of the created record.
func (s *seeder) create(path string, body any) string {
	var out struct {
		ID string `json:"id"`
	}
	s.do(http.MethodPost, path, body, &out)
	return out.ID
}

// id returns the id registered under key.
func (s *seeder) id(key string) string {
	v, ok := s.ids[key]
	if !ok {
		s.fail("unknown key %q", key)
	}
	return v
}

func (s *seeder) login(email, password string) {
	s.do(http.MethodPost, "/session", map[string]string{"email": email, "password": password}, nil)
}

type accountRow struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	SystemRole string `json:"system_role"`
}

func (s *seeder) listAccounts() []accountRow {
	var all []accountRow
	cursor := ""
	for s.err == nil {
		var page struct {
			Items      []accountRow `json:"items"`
			NextCursor string       `json:"next_cursor"`
		}
		path := "/accounts?limit=200"
		if cursor != "" {
			path += "&cursor=" + url.QueryEscape(cursor)
		}
		s.do(http.MethodGet, path, nil, &page)
		all = append(all, page.Items...)
		if page.NextCursor == "" {
			break
		}
		cursor = page.NextCursor
	}
	return all
}

// loadSystemAccounts waits for the ledger to provision the user, then registers each system account as "system.<role>". The provisioning runs from the outbox, so a user created a moment ago may not have them yet.
func (s *seeder) loadSystemAccounts() {
	deadline := time.Now().Add(30 * time.Second)
	for s.err == nil {
		found := false
		for _, a := range s.listAccounts() {
			if a.SystemRole != "" {
				s.ids["system."+a.SystemRole] = a.ID
				found = true
			}
		}
		if found {
			return
		}
		if time.Now().After(deadline) {
			s.fail("the ledger did not provision the user within 30 seconds")
			return
		}
		select {
		case <-s.ctx.Done():
			s.fail("wait for provisioning: %w", s.ctx.Err())
			return
		case <-time.After(time.Second):
		}
	}
}

// requireEmpty fails when the user already owns an account that is not a system account.
func (s *seeder) requireEmpty() {
	for _, a := range s.listAccounts() {
		if a.SystemRole == "" && s.err == nil {
			s.fail("the user already owns account %q; drop the user and create it again before seeding", a.Name)
		}
	}
}

type money struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

func brl(cents int64) money { return money{Amount: cents, Currency: "BRL"} }

type posting struct {
	AccountID string `json:"account_id"`
	Amount    money  `json:"amount"`
}

func post(account string, cents int64) posting {
	return posting{AccountID: account, Amount: brl(cents)}
}

// record posts a balanced transaction, keeps the running balances and returns its id.
func (s *seeder) record(date, description string, extra map[string]any, postings ...posting) string {
	body := map[string]any{"date": date, "description": description, "postings": postings}
	for k, v := range extra {
		body[k] = v
	}
	id := s.create("/transactions", body)
	if s.err == nil {
		for _, p := range postings {
			s.bal[p.AccountID] += p.Amount.Amount
			s.entries = append(s.entries, entry{date: date, account: p.AccountID, cents: p.Amount.Amount, desc: description})
		}
	}
	return id
}
