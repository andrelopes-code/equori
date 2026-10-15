package ledger

import (
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/ledger/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

type ledgerFixture struct {
	pool       *pgxpool.Pool
	dispatcher *outbox.Dispatcher
	svc        *app.Service
	userID     int64
	checking   domain.Account
	food       domain.Account
}

func newLedgerFixture(t testing.TB) ledgerFixture {
	t.Helper()
	pool := pgtest.New(t)
	d := outbox.NewDispatcher(pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	cal := calendarAdapter{marketdata.New(pool)}
	New(pool, d, cal.cal, clock.New(time.UTC, time.Now), slog.New(slog.NewTextHandler(io.Discard, nil)))
	f := ledgerFixture{pool: pool, dispatcher: d, svc: app.NewService(postgres.NewRepository(pool), clock.New(time.UTC, time.Now), cal)}
	f.userID = provisionedUser(t, pool, d)
	f.checking = f.createAccount(t, domain.Account{Name: "Nubank checking", Class: domain.ClassAsset, Kind: domain.KindChecking})
	f.food = f.createAccount(t, domain.Account{Name: "Food", Class: domain.ClassExpense})
	return f
}

// provisionedUser creates a user, publishes identity.user_created.v1 and dispatches it.
func provisionedUser(t testing.TB, pool *pgxpool.Pool, d *outbox.Dispatcher) int64 {
	t.Helper()
	userID := pgtest.CreateUser(t, pool)
	err := pgx.BeginFunc(t.Context(), pool, func(tx pgx.Tx) error {
		return outbox.Insert(t.Context(), tx, outbox.Event{
			Type: "identity.user_created.v1", UserID: userID, AggregateID: "u",
			Payload: map[string]any{"user_id": userID, "email": "x@example.com"},
		})
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := d.DispatchPending(t.Context()); err != nil {
		t.Fatal(err)
	}
	return userID
}

func (f ledgerFixture) createAccount(t testing.TB, a domain.Account) domain.Account {
	t.Helper()
	a.UserID = f.userID
	if a.Instrument == "" {
		a.Instrument = "BRL"
	}
	got, err := f.svc.CreateAccount(t.Context(), f.userID, a)
	if err != nil {
		t.Fatalf("CreateAccount(%s): %v", a.Name, err)
	}
	return got
}

func brl(t *testing.T, amount int64) money.Money {
	t.Helper()
	m, err := money.New(amount, "BRL")
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func date(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

func (f ledgerFixture) expense(t *testing.T, on string, amount int64) domain.Transaction {
	t.Helper()
	tx, err := f.svc.RecordTransaction(t.Context(), f.userID, domain.Transaction{
		Date:        date(on),
		Description: "expense",
		Postings: []domain.Posting{
			{AccountID: f.checking.ID, Amount: brl(t, -amount)},
			{AccountID: f.food.ID, Amount: brl(t, amount)},
		},
	})
	if err != nil {
		t.Fatalf("RecordTransaction: %v", err)
	}
	return tx
}

func (f ledgerFixture) eventCount(t *testing.T, eventType string) int {
	t.Helper()
	var n int
	if err := f.pool.QueryRow(t.Context(), `SELECT count(*) FROM outbox_event WHERE type = $1`, eventType).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestProvisionCreatesSystemAccounts(t *testing.T) {
	f := newLedgerFixture(t)

	settings, err := f.svc.Settings(t.Context(), f.userID)
	if err != nil || settings.BaseCurrency != "BRL" {
		t.Fatalf("settings = %+v, %v", settings, err)
	}
	accounts, err := f.svc.ListAccounts(t.Context(), f.userID)
	if err != nil {
		t.Fatal(err)
	}
	roles := map[domain.SystemRole]domain.Class{}
	for _, a := range accounts {
		if a.SystemRole != "" {
			roles[a.SystemRole] = a.Class
		}
	}
	for _, r := range domain.SystemRoles() {
		if roles[r] != r.Class() {
			t.Errorf("system role %s: class %q, want %q", r, roles[r], r.Class())
		}
	}

	if err := f.svc.Provision(t.Context(), f.userID, "BRL"); err != nil {
		t.Fatal(err)
	}
	again, _ := f.svc.ListAccounts(t.Context(), f.userID)
	if len(again) != len(accounts) {
		t.Fatalf("second provisioning created %d accounts", len(again)-len(accounts))
	}
}

func TestRecordTransactionPublishesEvent(t *testing.T) {
	f := newLedgerFixture(t)

	tx := f.expense(t, "2026-10-14", 23000)

	got, err := f.svc.Transaction(t.Context(), f.userID, tx.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Postings) != 2 || got.Postings[0].AccountID != f.checking.ID || got.Postings[1].Amount != brl(t, 23000) {
		t.Fatalf("stored postings = %+v", got.Postings)
	}
	if n := f.eventCount(t, "ledger.transaction_recorded.v1"); n != 1 {
		t.Fatalf("recorded events = %d, want 1", n)
	}
}

func TestRecordRejectsForeignAccount(t *testing.T) {
	f := newLedgerFixture(t)
	otherUser := provisionedUser(t, f.pool, f.dispatcher)
	otherFood, err := f.svc.CreateAccount(t.Context(), otherUser, domain.Account{
		UserID: otherUser, Name: "Food", Class: domain.ClassExpense, Instrument: "BRL",
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = f.svc.RecordTransaction(t.Context(), f.userID, domain.Transaction{
		Date: date("2026-10-14"),
		Postings: []domain.Posting{
			{AccountID: f.checking.ID, Amount: brl(t, -100)},
			{AccountID: otherFood.ID, Amount: brl(t, 100)},
		},
	})
	fe, ok := errors.AsType[*domain.FieldError](err)
	if !ok || !errors.Is(err, domain.ErrUnknownAccount) || fe.Field != "postings[1].account_id" {
		t.Fatalf("err = %v, want unknown account on postings[1].account_id", err)
	}
}

func TestCorrectWritesVersion(t *testing.T) {
	f := newLedgerFixture(t)
	tx := f.expense(t, "2026-10-14", 2300)

	corrected, err := f.svc.CorrectTransaction(t.Context(), f.userID, tx.ID, 1, domain.Transaction{
		Date: date("2026-10-14"),
		Postings: []domain.Posting{
			{AccountID: f.checking.ID, Amount: brl(t, -3200)},
			{AccountID: f.food.ID, Amount: brl(t, 3200)},
		},
	}, "typo")
	if err != nil {
		t.Fatal(err)
	}
	if corrected.Version != 2 {
		t.Fatalf("version = %d", corrected.Version)
	}
	versions, err := f.svc.Versions(t.Context(), f.userID, tx.ID)
	if err != nil || len(versions) != 1 || versions[0].Version != 1 || versions[0].Reason != "typo" {
		t.Fatalf("versions = %+v, %v", versions, err)
	}
	if versions[0].Transaction.Postings[0].Amount != brl(t, -2300) {
		t.Fatalf("snapshot postings = %+v", versions[0].Transaction.Postings)
	}
	if n := f.eventCount(t, "ledger.transaction_corrected.v1"); n != 1 {
		t.Fatalf("corrected events = %d", n)
	}
}

func TestConcurrentCorrectionsConflict(t *testing.T) {
	f := newLedgerFixture(t)
	tx := f.expense(t, "2026-10-14", 2300)

	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := range 2 {
		wg.Go(func() {
			_, errs[i] = f.svc.CorrectTransaction(t.Context(), f.userID, tx.ID, 1, domain.Transaction{
				Date: date("2026-10-14"),
				Postings: []domain.Posting{
					{AccountID: f.checking.ID, Amount: brl(t, -int64(1000+i))},
					{AccountID: f.food.ID, Amount: brl(t, int64(1000+i))},
				},
			}, "race")
		})
	}
	wg.Wait()

	conflicts := 0
	for _, err := range errs {
		switch {
		case errors.Is(err, domain.ErrVersionConflict):
			conflicts++
		case err != nil:
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if conflicts != 1 {
		t.Fatalf("conflicts = %d, want exactly 1 (errs %v)", conflicts, errs)
	}
}

func TestVoidKeepsHistory(t *testing.T) {
	f := newLedgerFixture(t)
	tx := f.expense(t, "2026-10-14", 2300)

	if err := f.svc.VoidTransaction(t.Context(), f.userID, tx.ID, "duplicate"); err != nil {
		t.Fatal(err)
	}
	got, err := f.svc.Transaction(t.Context(), f.userID, tx.ID)
	if err != nil || got.VoidedAt == nil || got.VoidReason != "duplicate" {
		t.Fatalf("voided = %+v, %v", got, err)
	}
	if err := f.svc.VoidTransaction(t.Context(), f.userID, tx.ID, "again"); !errors.Is(err, domain.ErrVoided) {
		t.Fatalf("second void err = %v", err)
	}
}

func TestCloseAccountRequiresZeroBalance(t *testing.T) {
	f := newLedgerFixture(t)
	f.expense(t, "2026-10-14", 2300)

	if err := f.svc.CloseAccount(t.Context(), f.userID, f.checking.ID, date("2026-10-31")); !errors.Is(err, app.ErrNonZeroBalance) {
		t.Fatalf("close err = %v, want ErrNonZeroBalance", err)
	}

	empty := f.createAccount(t, domain.Account{Name: "Old wallet", Class: domain.ClassAsset, Kind: domain.KindCash})
	if err := f.svc.CloseAccount(t.Context(), f.userID, empty.ID, date("2026-10-31")); err != nil {
		t.Fatal(err)
	}
	if n := f.eventCount(t, "ledger.account_closed.v1"); n != 1 {
		t.Fatalf("closed events = %d", n)
	}
}

func TestListTransactionsCursor(t *testing.T) {
	f := newLedgerFixture(t)
	want := map[uuid.UUID]bool{}
	for _, d := range []string{"2026-10-01", "2026-10-05", "2026-10-05", "2026-10-05", "2026-10-05", "2026-10-05", "2026-10-09"} {
		want[f.expense(t, d, 100).ID] = true
	}

	seen := map[uuid.UUID]bool{}
	var cursor *app.TransactionCursor
	var prev *domain.Transaction
	for range 10 {
		page, next, err := f.svc.ListTransactions(t.Context(), app.TransactionQuery{UserID: f.userID, After: cursor, Limit: 2})
		if err != nil {
			t.Fatal(err)
		}
		for _, tx := range page {
			if seen[tx.ID] {
				t.Fatalf("transaction %s returned twice", tx.ID)
			}
			seen[tx.ID] = true
			if prev != nil && (tx.Date.After(prev.Date) || (tx.Date.Equal(prev.Date) && tx.ID.String() > prev.ID.String())) {
				t.Fatalf("order broken: %s %s after %s %s", tx.Date, tx.ID, prev.Date, prev.ID)
			}
			p := tx
			prev = &p
		}
		if next == nil {
			break
		}
		cursor = next
	}
	if len(seen) != len(want) {
		t.Fatalf("saw %d transactions, want %d", len(seen), len(want))
	}
}
