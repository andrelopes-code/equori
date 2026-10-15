package outbox

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	batchSize       = 100
	maxAttempts     = 10
	pollInterval    = 5 * time.Second
	cleanupInterval = time.Hour
	retention       = 30 * 24 * time.Hour
)

type subscription struct {
	consumer  string
	eventType string
	handler   Handler
}

// Dispatcher delivers events to subscriptions. One dispatcher runs per process (ADR 006).
type Dispatcher struct {
	pool *pgxpool.Pool
	log  *slog.Logger
	subs []subscription
	now  func() time.Time
}

func NewDispatcher(pool *pgxpool.Pool, log *slog.Logger) *Dispatcher {
	return &Dispatcher{pool: pool, log: log, now: time.Now}
}

// Subscribe must be called before Run. The consumer name identifies the delivery
// state; renaming a consumer redelivers every retained event to it.
func (d *Dispatcher) Subscribe(consumer, eventType string, h Handler) {
	d.subs = append(d.subs, subscription{consumer: consumer, eventType: eventType, handler: h})
}

// Run dispatches until ctx is canceled, woken by NOTIFY or every pollInterval.
func (d *Dispatcher) Run(ctx context.Context) error {
	conn, err := d.pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire listen connection: %w", err)
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, "LISTEN outbox"); err != nil {
		return fmt.Errorf("listen outbox: %w", err)
	}

	lastCleanup := time.Time{}
	for {
		if _, err := d.DispatchPending(ctx); err != nil && ctx.Err() == nil {
			d.log.ErrorContext(ctx, "outbox dispatch failed", "error", err)
		}
		if d.now().Sub(lastCleanup) >= cleanupInterval {
			if err := d.cleanup(ctx); err != nil && ctx.Err() == nil {
				d.log.ErrorContext(ctx, "outbox cleanup failed", "error", err)
			}
			lastCleanup = d.now()
		}

		waitCtx, cancel := context.WithTimeout(ctx, pollInterval)
		_, err := conn.Conn().WaitForNotification(waitCtx)
		cancel()
		if ctx.Err() != nil {
			return nil
		}
		if err != nil && !errors.Is(err, context.DeadlineExceeded) {
			return fmt.Errorf("wait for outbox notification: %w", err)
		}
	}
}

// DispatchPending runs one pass over every subscription and returns the number of successful deliveries.
func (d *Dispatcher) DispatchPending(ctx context.Context) (int, error) {
	delivered := 0
	for _, s := range d.subs {
		events, err := d.pending(ctx, s)
		if err != nil {
			return delivered, err
		}
		for _, e := range events {
			ok, err := d.deliver(ctx, s, e)
			if err != nil {
				return delivered, err
			}
			if ok {
				delivered++
			}
		}
	}
	return delivered, nil
}

func (d *Dispatcher) pending(ctx context.Context, s subscription) ([]Delivered, error) {
	rows, err := d.pool.Query(ctx, `
		SELECT e.id, e.type, e.user_id, e.aggregate_id, e.payload, e.occurred_at
		FROM outbox_event e
		LEFT JOIN outbox_delivery d ON d.event_id = e.id AND d.consumer = $2
		WHERE e.type = $1
		  AND (d.event_id IS NULL OR (d.status = 'retrying' AND d.next_attempt_at <= $3))
		ORDER BY e.id
		LIMIT $4`, s.eventType, s.consumer, d.now(), batchSize)
	if err != nil {
		return nil, fmt.Errorf("select pending %s events for %s: %w", s.eventType, s.consumer, err)
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Delivered, error) {
		var e Delivered
		err := r.Scan(&e.ID, &e.Type, &e.UserID, &e.AggregateID, &e.Payload, &e.OccurredAt)
		return e, err
	})
}

// deliver reports false when the handler failed and the failure was recorded for retry.
func (d *Dispatcher) deliver(ctx context.Context, s subscription, e Delivered) (bool, error) {
	handlerErr := pgx.BeginFunc(ctx, d.pool, func(tx pgx.Tx) error {
		if err := s.handler(ctx, tx, e); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO outbox_delivery (event_id, consumer, status, attempts, delivered_at)
			VALUES ($1, $2, 'delivered', 1, $3)
			ON CONFLICT (event_id, consumer) DO UPDATE
			SET status = 'delivered', attempts = outbox_delivery.attempts + 1,
			    delivered_at = $3, next_attempt_at = NULL, last_error = NULL`,
			e.ID, s.consumer, d.now())
		return err
	})
	if handlerErr == nil {
		return true, nil
	}
	if ctx.Err() != nil {
		return false, ctx.Err()
	}

	// Attempt n waits 2^(n-1) seconds, capped at 10 minutes.
	_, err := d.pool.Exec(ctx, `
		INSERT INTO outbox_delivery (event_id, consumer, status, attempts, next_attempt_at, last_error)
		VALUES ($1, $2, 'retrying', 1, $3::timestamptz + interval '1 second', $4)
		ON CONFLICT (event_id, consumer) DO UPDATE
		SET attempts = outbox_delivery.attempts + 1,
		    status = CASE WHEN outbox_delivery.attempts + 1 >= $5 THEN 'failed' ELSE 'retrying' END,
		    next_attempt_at = $3::timestamptz + least(interval '1 second' * power(2, outbox_delivery.attempts), interval '10 minutes'),
		    last_error = $4`,
		e.ID, s.consumer, d.now(), handlerErr.Error(), maxAttempts)
	if err != nil {
		return false, fmt.Errorf("record failed delivery of %s to %s: %w", e.ID, s.consumer, err)
	}
	d.log.WarnContext(ctx, "outbox handler failed", "consumer", s.consumer, "event_id", e.ID, "error", handlerErr)
	return false, nil
}

func (d *Dispatcher) cleanup(ctx context.Context) error {
	_, err := d.pool.Exec(ctx, `
		DELETE FROM outbox_event e
		WHERE e.occurred_at < $1
		  AND NOT EXISTS (
		      SELECT 1 FROM outbox_delivery d
		      WHERE d.event_id = e.id AND d.status IN ('retrying', 'failed'))`,
		d.now().Add(-retention))
	return err
}
