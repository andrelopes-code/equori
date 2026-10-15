# ADR 006: Transactional outbox for domain events between modules

- Status: accepted
- Date: 2026-10-15

## Context

Policies that cross bounded contexts (docs/domain/04-contexts.md, section 4.4) must run after a change commits: Classification categorizes a recorded transaction, Planning realizes an occurrence, Portfolio recomputes a position. An in-memory event bus loses events on a crash between commit and delivery. A synchronous call chain couples the modules and makes one module's failure abort another module's transaction.

## Decision

- A module that publishes an event inserts it into `outbox_event` in the same database transaction as the change. Columns: `id` (UUIDv7), `user_id`, `type`, `aggregate_id`, `payload` (`jsonb`), `occurred_at`.
- Delivery state is per consumer in `outbox_delivery (event_id, consumer, status, attempts, next_attempt_at, last_error, delivered_at)`, status `delivered`, `retrying` or `failed`.
- A dispatcher goroutine in the same binary reads, per consumer, the events without a final delivery in `id` order, in batches of 100 repeated until a pass delivers nothing, and calls the handler. It wakes on `LISTEN/NOTIFY` after each commit and polls every 5 s as a fallback. One dispatcher per process (ADR 002: one instance).
- A handler receives the dispatcher's database transaction; its writes and the `delivered` row commit together, so a database effect of a handler happens exactly once.
- A handler error or panic retries with exponential backoff (1 s to 10 min). After 10 failures the delivery is marked `failed` and shown in an operations view; other events keep flowing.
- Event payloads are versioned (`type` = `ledger.transaction_recorded.v1`). A payload change creates a new version; handlers accept the versions still present in the table.
- Events older than 30 days without a `retrying` or `failed` delivery are deleted.

Implementation: `internal/platform/outbox`.

## Consequences

- A downstream reaction lags its cause by the dispatch time (milliseconds in normal operation; up to a restart after a crash).
- Event ordering is guaranteed per publishing module only.
