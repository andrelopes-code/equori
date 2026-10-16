// Package outbox stores domain events in the publisher's database transaction
// and delivers them to subscribed consumers after commit (ADR 006).
package outbox

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Event struct {
	Type        string
	UserID      int64
	AggregateID string
	Payload     any
}

type Delivered struct {
	ID          uuid.UUID
	Type        string
	UserID      int64
	AggregateID string
	Payload     []byte
	OccurredAt  time.Time
}

// Handler runs inside the dispatcher's transaction: its writes commit together
// with the delivery record, or roll back with it.
type Handler func(ctx context.Context, tx pgx.Tx, e Delivered) error

// Insert must run in the transaction that makes the change the event describes.
func Insert(ctx context.Context, tx pgx.Tx, e Event) error {
	payload, err := json.Marshal(e.Payload)
	if err != nil {
		return fmt.Errorf("marshal %s payload: %w", e.Type, err)
	}
	// One round trip: the insert and the notification travel in one statement.
	_, err = tx.Exec(ctx, `WITH inserted AS (
		INSERT INTO outbox_event (user_id, type, aggregate_id, payload) VALUES ($1, $2, $3, $4) RETURNING 1
	) SELECT pg_notify('outbox', '') FROM inserted`,
		e.UserID, e.Type, e.AggregateID, payload)
	if err != nil {
		return fmt.Errorf("insert %s event: %w", e.Type, err)
	}
	return nil
}
