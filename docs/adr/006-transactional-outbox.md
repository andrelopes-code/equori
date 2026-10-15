# ADR 006: Transactional outbox for domain events between modules

- Status: accepted
- Date: 2026-10-15

## Context

Policies that cross bounded contexts (docs/domain/04-contexts.md, section 4.4) must run after a change commits: Classification categorizes a recorded transaction, Planning realizes an occurrence, Portfolio recomputes a position. An in-memory event bus loses events on a crash between commit and delivery. A synchronous call chain couples the modules and makes one module's failure abort another module's transaction.

## Decision

- A module that publishes an event inserts it into `outbox_event` in the same database transaction as the change. Columns: `id` (UUIDv7), `user_id`, `type`, `aggregate_id`, `payload` (`jsonb`), `occurred_at`, `delivered_at`.
- A dispatcher goroutine in the same binary reads undelivered events in `id` order with `FOR UPDATE SKIP LOCKED`, calls the subscribed handlers and sets `delivered_at`. It wakes on `LISTEN/NOTIFY` after each commit and polls every 5 s as a fallback.
- Delivery is at least once. Every handler is idempotent by event id: it records processed ids in its own module (`<module>_processed_event`) inside its own database transaction.
- A handler error retries with exponential backoff (1 s to 10 min). After 10 failures the event is marked `failed` and shown in an operations view; other events keep flowing.
- Event payloads are versioned (`type` = `ledger.transaction_recorded.v1`). A payload change creates a new version; handlers accept the versions still present in the table.
- Delivered events are deleted after 30 days.

Implementation: `internal/platform/outbox`.

## Consequences

- A downstream reaction lags its cause by the dispatch time (milliseconds in normal operation; up to a restart after a crash).
- Event ordering is guaranteed per publishing module only.
