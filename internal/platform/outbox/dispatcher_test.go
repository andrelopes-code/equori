package outbox_test

import (
	"context"
	"encoding/json/v2"
	"errors"
	"io"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

const eventType = "test.happened.v1"

func newDispatcher(pool *pgxpool.Pool) *outbox.Dispatcher {
	return outbox.NewDispatcher(pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func insertEvent(t *testing.T, pool *pgxpool.Pool, e outbox.Event) {
	t.Helper()
	err := pgx.BeginFunc(t.Context(), pool, func(tx pgx.Tx) error { return outbox.Insert(t.Context(), tx, e) })
	if err != nil {
		t.Fatal(err)
	}
}

func dispatch(t *testing.T, d *outbox.Dispatcher) int {
	t.Helper()
	n, err := d.DispatchPending(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func delivery(t *testing.T, pool *pgxpool.Pool, consumer string) (status string, attempts int) {
	t.Helper()
	err := pool.QueryRow(t.Context(),
		`SELECT status, attempts FROM outbox_delivery WHERE consumer = $1`, consumer).Scan(&status, &attempts)
	if err != nil {
		t.Fatal(err)
	}
	return status, attempts
}

func TestInsertIsTransactional(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	userID := pgtest.CreateUser(t, pool)
	errRollback := errors.New("rollback")

	err := pgx.BeginFunc(t.Context(), pool, func(tx pgx.Tx) error {
		if err := outbox.Insert(t.Context(), tx, outbox.Event{Type: eventType, UserID: userID, AggregateID: "x", Payload: 1}); err != nil {
			return err
		}
		return errRollback
	})
	if !errors.Is(err, errRollback) {
		t.Fatalf("err = %v", err)
	}
	var n int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM outbox_event`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("events = %d, %v; want 0", n, err)
	}
}

func TestDispatchDeliversOncePerConsumer(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	userID := pgtest.CreateUser(t, pool)
	d := newDispatcher(pool)
	var a, b atomic.Int32
	d.Subscribe("consumer-a", eventType, func(context.Context, pgx.Tx, outbox.Delivered) error { a.Add(1); return nil })
	d.Subscribe("consumer-b", eventType, func(context.Context, pgx.Tx, outbox.Delivered) error { b.Add(1); return nil })
	insertEvent(t, pool, outbox.Event{Type: eventType, UserID: userID, AggregateID: "x", Payload: map[string]int{"n": 1}})

	if n := dispatch(t, d); n != 2 {
		t.Fatalf("first pass delivered %d, want 2", n)
	}
	if n := dispatch(t, d); n != 0 {
		t.Fatalf("second pass delivered %d, want 0", n)
	}
	if a.Load() != 1 || b.Load() != 1 {
		t.Fatalf("calls a=%d b=%d, want 1 each", a.Load(), b.Load())
	}
}

func TestDeliveredCarriesEvent(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	userID := pgtest.CreateUser(t, pool)
	d := newDispatcher(pool)
	var got outbox.Delivered
	d.Subscribe("c", eventType, func(_ context.Context, _ pgx.Tx, e outbox.Delivered) error { got = e; return nil })
	insertEvent(t, pool, outbox.Event{Type: eventType, UserID: userID, AggregateID: "agg-1", Payload: map[string]int{"n": 7}})

	dispatch(t, d)

	var payload map[string]int
	if err := json.Unmarshal(got.Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if got.Type != eventType || got.UserID != userID || got.AggregateID != "agg-1" || payload["n"] != 7 || got.OccurredAt.IsZero() {
		t.Fatalf("delivered = %+v, payload %v", got, payload)
	}
}

func TestHandlerWritesCommitWithDelivery(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	userID := pgtest.CreateUser(t, pool)
	if _, err := pool.Exec(t.Context(), `CREATE TABLE scratch (n int)`); err != nil {
		t.Fatal(err)
	}
	d := newDispatcher(pool)
	d.Subscribe("c", eventType, func(ctx context.Context, tx pgx.Tx, _ outbox.Delivered) error {
		_, err := tx.Exec(ctx, `INSERT INTO scratch VALUES (1)`)
		return err
	})
	insertEvent(t, pool, outbox.Event{Type: eventType, UserID: userID, AggregateID: "x", Payload: 1})

	dispatch(t, d)

	var n int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM scratch`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("scratch rows = %d, %v; want 1", n, err)
	}
	if status, _ := delivery(t, pool, "c"); status != "delivered" {
		t.Fatalf("status = %s", status)
	}
}

func TestHandlerErrorRetriesWithBackoff(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	userID := pgtest.CreateUser(t, pool)
	if _, err := pool.Exec(t.Context(), `CREATE TABLE scratch (n int)`); err != nil {
		t.Fatal(err)
	}
	d := newDispatcher(pool)
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	outbox.SetClock(d, func() time.Time { return now })
	var calls atomic.Int32
	d.Subscribe("c", eventType, func(ctx context.Context, tx pgx.Tx, _ outbox.Delivered) error {
		if _, err := tx.Exec(ctx, `INSERT INTO scratch VALUES (1)`); err != nil {
			return err
		}
		if calls.Add(1) <= 2 {
			return errors.New("temporary")
		}
		return nil
	})
	insertEvent(t, pool, outbox.Event{Type: eventType, UserID: userID, AggregateID: "x", Payload: 1})

	dispatch(t, d)
	assertRetry(t, pool, 1, now.Add(time.Second))
	dispatch(t, d)
	if calls.Load() != 1 {
		t.Fatalf("handler called before next_attempt_at: %d calls", calls.Load())
	}

	now = now.Add(time.Second)
	dispatch(t, d)
	assertRetry(t, pool, 2, now.Add(2*time.Second))

	now = now.Add(2 * time.Second)
	if n := dispatch(t, d); n != 1 {
		t.Fatalf("third attempt delivered %d, want 1", n)
	}
	var rows int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM scratch`).Scan(&rows); err != nil || rows != 1 {
		t.Fatalf("scratch rows = %d, %v; want 1 (failed attempts roll back)", rows, err)
	}
}

func assertRetry(t *testing.T, pool *pgxpool.Pool, attempts int, next time.Time) {
	t.Helper()
	var status string
	var gotAttempts int
	var gotNext time.Time
	err := pool.QueryRow(t.Context(),
		`SELECT status, attempts, next_attempt_at FROM outbox_delivery WHERE consumer = 'c'`).Scan(&status, &gotAttempts, &gotNext)
	if err != nil {
		t.Fatal(err)
	}
	if status != "retrying" || gotAttempts != attempts || !gotNext.Equal(next) {
		t.Fatalf("delivery = %s, %d, %v; want retrying, %d, %v", status, gotAttempts, gotNext, attempts, next)
	}
}

func TestTenthFailureMarksFailed(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	userID := pgtest.CreateUser(t, pool)
	d := newDispatcher(pool)
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	outbox.SetClock(d, func() time.Time { return now })
	var calls atomic.Int32
	d.Subscribe("c", eventType, func(context.Context, pgx.Tx, outbox.Delivered) error {
		calls.Add(1)
		return errors.New("permanent")
	})
	insertEvent(t, pool, outbox.Event{Type: eventType, UserID: userID, AggregateID: "x", Payload: 1})

	for range 12 {
		dispatch(t, d)
		now = now.Add(11 * time.Minute)
	}

	if status, attempts := delivery(t, pool, "c"); status != "failed" || attempts != 10 {
		t.Fatalf("delivery = %s, %d; want failed, 10", status, attempts)
	}
	if calls.Load() != 10 {
		t.Fatalf("handler calls = %d, want 10", calls.Load())
	}
}

func TestOtherEventsKeepFlowing(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	userID := pgtest.CreateUser(t, pool)
	d := newDispatcher(pool)
	var delivered []string
	d.Subscribe("c", eventType, func(_ context.Context, _ pgx.Tx, e outbox.Delivered) error {
		if e.AggregateID == "bad" {
			return errors.New("fails")
		}
		delivered = append(delivered, e.AggregateID)
		return nil
	})
	insertEvent(t, pool, outbox.Event{Type: eventType, UserID: userID, AggregateID: "bad", Payload: 1})
	insertEvent(t, pool, outbox.Event{Type: eventType, UserID: userID, AggregateID: "good", Payload: 1})

	dispatch(t, d)

	if len(delivered) != 1 || delivered[0] != "good" {
		t.Fatalf("delivered = %v, want [good]", delivered)
	}
}

func TestHandlerPanicIsRetriedNotFatal(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	userID := pgtest.CreateUser(t, pool)
	d := newDispatcher(pool)
	d.Subscribe("c", eventType, func(context.Context, pgx.Tx, outbox.Delivered) error { panic("handler bug") })
	insertEvent(t, pool, outbox.Event{Type: eventType, UserID: userID, AggregateID: "x", Payload: 1})

	if n := dispatch(t, d); n != 0 {
		t.Fatalf("delivered %d, want 0", n)
	}
	if status, attempts := delivery(t, pool, "c"); status != "retrying" || attempts != 1 {
		t.Fatalf("delivery = %s, %d; want retrying, 1", status, attempts)
	}
}

func TestDrainDeliversMoreThanOneBatch(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	userID := pgtest.CreateUser(t, pool)
	d := newDispatcher(pool)
	d.Subscribe("c", eventType, func(context.Context, pgx.Tx, outbox.Delivered) error { return nil })
	_, err := pool.Exec(t.Context(), `
		INSERT INTO outbox_event (user_id, type, aggregate_id, payload)
		SELECT $1, $2, g::text, '1' FROM generate_series(1, 250) g`, userID, eventType)
	if err != nil {
		t.Fatal(err)
	}

	n, err := outbox.Drain(t.Context(), d)
	if err != nil || n != 250 {
		t.Fatalf("Drain = %d, %v; want 250", n, err)
	}
}
