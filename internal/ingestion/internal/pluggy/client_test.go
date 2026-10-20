package pluggy_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy/pluggytest"
)

type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time { return c.now }

func newClient(t *testing.T, srv *pluggytest.Server, clk *fakeClock) (*pluggy.Client, *[]time.Duration) {
	t.Helper()
	var waits []time.Duration
	c, err := pluggy.NewClient(srv.URL(), srv.HTTPClient(), clk.Now)
	if err != nil {
		t.Fatal(err)
	}
	c.Sleep = func(_ context.Context, d time.Duration) error { waits = append(waits, d); return nil }
	return c, &waits
}

func TestClientReadsItemAccountsBillsAndTransactions(t *testing.T) {
	t.Parallel()
	srv := pluggytest.New(t, "client-id", "client-secret")
	srv.AddItem(pluggy.Item{ID: "item-1", Status: pluggy.StatusUpdated})
	srv.AddAccount("item-1", pluggy.Account{ID: "acc-1", Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Conta", Number: "0001/12345-0", Balance: "2834.1", CurrencyCode: "BRL"})
	srv.AddBill("acc-1", pluggy.Bill{ID: "bill-1", DueDate: "2026-11-10T00:00:00.000Z", TotalAmount: "1500"})
	for i := range 1201 {
		srv.AddTransaction("acc-1", pluggy.Transaction{ID: fmt.Sprintf("t%04d", i), Amount: "-1", CurrencyCode: "BRL", Date: "2026-10-15T00:00:00.000Z", Status: "POSTED"})
	}
	srv.AddTransaction("acc-1", pluggy.Transaction{ID: "late", Amount: "-1", CurrencyCode: "BRL", Date: "2026-11-20T00:00:00.000Z", Status: "POSTED"})
	clk := &fakeClock{now: time.Date(2026, 11, 12, 12, 0, 0, 0, time.UTC)}
	c, _ := newClient(t, srv, clk)
	ctx := t.Context()

	s, err := c.Session(ctx, "client-id", "client-secret")
	if err != nil {
		t.Fatal(err)
	}
	item, err := s.Item(ctx, "item-1")
	if err != nil || item.Status != pluggy.StatusUpdated {
		t.Fatalf("item = %+v, %v", item, err)
	}
	if _, err := s.Item(ctx, "item-x"); !errors.Is(err, pluggy.ErrNotFound) {
		t.Fatalf("missing item: %v", err)
	}
	accounts, err := s.Accounts(ctx, "item-1")
	if err != nil || len(accounts) != 1 || accounts[0].Balance != "2834.1" {
		t.Fatalf("accounts = %+v, %v", accounts, err)
	}
	bills, err := s.Bills(ctx, "acc-1")
	if err != nil || len(bills) != 1 || bills[0].ID != "bill-1" {
		t.Fatalf("bills = %+v, %v", bills, err)
	}
	txs, err := s.Transactions(ctx, "acc-1", time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 12, 0, 0, 0, 0, time.UTC))
	if err != nil || len(txs) != 1201 || txs[1200].ID != "t1200" {
		t.Fatalf("transactions = %d, %v", len(txs), err)
	}
	if got := srv.Requests("/v2/transactions"); got != 3 {
		t.Fatalf("transaction pages = %d, want 3", got)
	}
}

func TestClientRetriesAndRenewsKeys(t *testing.T) {
	t.Parallel()
	srv := pluggytest.New(t, "client-id", "client-secret")
	srv.AddItem(pluggy.Item{ID: "item-1", Status: pluggy.StatusUpdated})
	clk := &fakeClock{now: time.Date(2026, 11, 12, 12, 0, 0, 0, time.UTC)}
	c, waits := newClient(t, srv, clk)
	ctx := t.Context()

	if _, err := c.Session(ctx, "client-id", "wrong"); !errors.Is(err, pluggy.ErrUnauthorized) {
		t.Fatalf("wrong secret: %v", err)
	}
	sessions := pluggy.NewSessions(c)
	s1, err := sessions.Get(ctx, "integration-1", "client-id", "client-secret")
	if err != nil {
		t.Fatal(err)
	}
	clk.now = clk.now.Add(100 * time.Minute)
	if s2, err := sessions.Get(ctx, "integration-1", "client-id", "client-secret"); err != nil || s2 != s1 || srv.Requests("/auth") != 2 {
		t.Fatalf("key renewed early: %v, auth calls %d", err, srv.Requests("/auth"))
	}
	clk.now = clk.now.Add(11 * time.Minute)
	if s3, err := sessions.Get(ctx, "integration-1", "client-id", "client-secret"); err != nil || s3 == s1 || srv.Requests("/auth") != 3 {
		t.Fatalf("key not renewed 10 minutes before expiry: %v, auth calls %d", err, srv.Requests("/auth"))
	}

	s, _ := sessions.Get(ctx, "integration-1", "client-id", "client-secret")
	srv.FailNext(http.StatusTooManyRequests, 2)
	if _, err := s.Item(ctx, "item-1"); err != nil || len(*waits) != 2 || (*waits)[0] != 7*time.Second {
		t.Fatalf("after 429: %v, waits %v", err, *waits)
	}
	srv.FailNext(http.StatusBadGateway, 3)
	if _, err := s.Item(ctx, "item-1"); err == nil {
		t.Fatal("three 502 responses succeeded")
	}
	srv.RevokeKeys()
	if _, err := s.Item(ctx, "item-1"); !errors.Is(err, pluggy.ErrUnauthorized) {
		t.Fatalf("revoked key: %v", err)
	}
}

// N17: requests reach only the configured base URL, even when a cursor names another host.
func TestClientRefusesForeignCursor(t *testing.T) {
	t.Parallel()
	other := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { t.Error("request reached another host") }))
	defer other.Close()
	srv := pluggytest.New(t, "client-id", "client-secret")
	srv.AddTransaction("acc-1", pluggy.Transaction{ID: "t1", Amount: "-1", CurrencyCode: "BRL", Date: "2026-10-15T00:00:00.000Z", Status: "POSTED"})
	srv.SetNext(other.URL + "/v2/transactions?after=x")
	c, _ := newClient(t, srv, &fakeClock{now: time.Date(2026, 11, 12, 0, 0, 0, 0, time.UTC)})
	s, err := c.Session(t.Context(), "client-id", "client-secret")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Transactions(t.Context(), "acc-1", time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 12, 0, 0, 0, 0, time.UTC)); err == nil {
		t.Fatal("foreign cursor followed")
	}
}

// A44: a transport error names the endpoint, not the URL with its item or account id.
func TestClientErrorsCarryNoIdentifiers(t *testing.T) {
	t.Parallel()
	srv := pluggytest.New(t, "client-id", "client-secret")
	srv.AddItem(pluggy.Item{ID: "item-7c1e", Status: pluggy.StatusUpdated})
	clk := &fakeClock{now: time.Date(2026, 11, 12, 12, 0, 0, 0, time.UTC)}
	c, _ := newClient(t, srv, clk)
	s, err := c.Session(t.Context(), "client-id", "client-secret")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err = s.Item(ctx, "item-7c1e")
	if err == nil || strings.Contains(err.Error(), "item-7c1e") || !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v", err)
	}
	if _, err := s.Accounts(ctx, "item-7c1e"); err == nil || strings.Contains(err.Error(), "item-7c1e") {
		t.Fatalf("accounts err = %v", err)
	}
}
