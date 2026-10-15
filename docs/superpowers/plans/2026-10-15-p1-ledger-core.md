# P1 Ledger Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver roadmap phase P1: instruments, accounts of every class, transactions with balanced postings, corrections and voids with history, links, the transactional outbox, balances by booked and settled date, the daily balance series and the HTTP API for all of it.

**Architecture:** New modules `ledger`, `marketdata` and `reporting` follow ADR 002 (root package API, `internal/domain`, `internal/app`, `internal/adapter/{postgres,httpapi}`). Cross-module reactions go through `internal/platform/outbox` (ADR 006, amended in Task 1). Money-protecting invariants are enforced in the domain and repeated in PostgreSQL triggers (chapter 7, 7.6).

**Tech Stack:** Go 1.27, PostgreSQL 18, pgx/v5, sqlc, goose, oapi-codegen strict server, `platform/money`, `platform/page`, `platform/clock`.

**Spec:** `docs/domain/` chapters 5 (domain model), 6 (scenarios), 7 (data model) and 9 (roadmap, phase P1); ADRs 001–006.

## Global Constraints

- Everything in English; Conventional Commits; no AI mentions in commits (CLAUDE.md).
- `make check` passes at the end of every task; `make gen` after editing `db/queries`, `db/migrations` or `api/openapi.yaml`.
- Identifiers: `uuid DEFAULT uuidv7()` for business tables; `user_id bigint` on every business table; composite foreign keys `(user_id, id)` (DD2, DD3).
- Enumerations as `text` + `CHECK`; amounts `bigint`; dates `date`; instants `timestamptz` (chapter 7, 7.1).
- `|amount| ≤ 2^53 − 1` (`money.MaxAmount`); no floating point in domain packages (N03).
- API: money as `{"amount": <int>, "currency": "<ISO>"}`; dates `YYYY-MM-DD`; errors RFC 9457 with codes from `api/openapi.yaml`; lists use `limit` (1–200, default 50) and opaque `cursor` (ADR 005).
- Every `/api/` route is authenticated by `identity.RequireSession`; handlers read the user with `auth.MustUserID(ctx)`.
- Scope adjustment: the business-day calendar moves from P1 to P2 (first consumer: billing). Chapter 9 is updated in Task 9.

## Review Focus

1. Two corrections of the same transaction based on the same version: the second must fail with 409 `version_conflict`, never overwrite the first (Task 5).
2. A posting that references an account id of another user: must return 422 `invalid_account`, never 500 and never succeed (Tasks 3 and 5).
3. Cursor pagination over many transactions on the same date: every transaction appears exactly once across pages (Task 7).
4. A voided transaction: disappears from every balance and from the daily series, and is still readable with its versions (Tasks 6 and 8).
5. A posting with amount 0, or with |amount| > 2^53 − 1: rejected with 422 `validation_failed` and a field error (Tasks 4 and 7).

---

## File Structure

| Path | Responsibility |
|---|---|
| `db/migrations/00002_outbox.sql` | `outbox_event`, `outbox_delivery` |
| `db/migrations/00003_marketdata.sql` | `marketdata_instrument` with currency seed |
| `db/migrations/00004_ledger.sql` | Ledger P1 tables, composite keys, triggers I01, I02, I09 |
| `db/migrations/00005_reporting.sql` | `reporting_account_day` |
| `internal/platform/outbox/outbox.go` | `Event`, `Insert`, `Delivered`, `Handler` |
| `internal/platform/outbox/dispatcher.go` | Dispatcher loop, retries, cleanup |
| `internal/marketdata/marketdata.go` | Module API: `Instrument`, `Currencies` |
| `internal/marketdata/internal/adapter/postgres/` | sqlc queries |
| `internal/ledger/ledger.go` | Module API: `New`, `RegisterRoutes`, `Subscribe` |
| `internal/ledger/internal/domain/account.go` | `Account`, `Class`, `Kind`, `SystemRole`, rules |
| `internal/ledger/internal/domain/transaction.go` | `Transaction`, `Posting`, `Link`, I01, I02, corrections, voids |
| `internal/ledger/internal/domain/errors.go` | Domain errors with field names |
| `internal/ledger/internal/app/ports.go` | `Repository` with `InTx`, `Publisher` |
| `internal/ledger/internal/app/provisioning.go` | System accounts and settings for a new user |
| `internal/ledger/internal/app/accounts.go` | Institutions, accounts, payees, tags |
| `internal/ledger/internal/app/transactions.go` | Record, correct, void, get, list, links |
| `internal/ledger/internal/app/balances.go` | Balance at a date |
| `internal/ledger/internal/adapter/postgres/repository.go` | Ports implementation over sqlc |
| `internal/ledger/internal/adapter/httpapi/server.go` | Strict server handlers, error mapping |
| `internal/reporting/reporting.go` | Module API, event handlers |
| `internal/reporting/internal/...` | Series rebuild and query |
| `db/queries/{ledger,marketdata,reporting}/*.sql` | sqlc queries |
| `api/openapi.yaml` | Tags `ledger`, `reporting` |
| `internal/ledger/scenarios_test.go` | Acceptance scenarios S01–S04, S19, S20, S23 (checking) |

---

## Slice A (Tasks 1–3): infrastructure and schema

### Task 1: Transactional outbox

**Files:**
- Create: `db/migrations/00002_outbox.sql`, `internal/platform/outbox/outbox.go`, `internal/platform/outbox/dispatcher.go`, `internal/platform/outbox/dispatcher_test.go`
- Modify: `docs/adr/006-transactional-outbox.md`, `cmd/equori/main.go`

**Interfaces:**
- Produces:
  - `type Event struct { Type string; UserID int64; AggregateID string; Payload any }`
  - `func Insert(ctx context.Context, tx pgx.Tx, e Event) error`
  - `type Delivered struct { ID uuid.UUID; Type string; UserID int64; AggregateID string; Payload json.RawMessage; OccurredAt time.Time }` (`uuid` from `github.com/google/uuid`, already a transitive dependency of pgx; promote to direct)
  - `type Handler func(ctx context.Context, tx pgx.Tx, e Delivered) error`
  - `func NewDispatcher(pool *pgxpool.Pool, log *slog.Logger) *Dispatcher`
  - `func (d *Dispatcher) Subscribe(consumer, eventType string, h Handler)`
  - `func (d *Dispatcher) Run(ctx context.Context) error` (blocks)
  - `func (d *Dispatcher) DispatchPending(ctx context.Context) (int, error)` (one pass; used by tests)

- [ ] **Step 1: Amend ADR 006.** Replace the `delivered_at` column and the `<module>_processed_event` tables with per-consumer delivery state:

```markdown
- Delivery state is per consumer in `outbox_delivery (event_id, consumer, status, attempts, next_attempt_at, last_error, delivered_at)`, status `delivered`, `retrying` or `failed`.
- A handler receives the dispatcher's database transaction; its writes and the `delivered` row commit together, so a database effect of a handler happens exactly once.
- One dispatcher goroutine per process (ADR 002: one instance).
```

- [ ] **Step 2: Write the migration.**

```sql
-- +goose Up
CREATE TABLE outbox_event (
    id           uuid        PRIMARY KEY DEFAULT uuidv7(),
    user_id      bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    type         text        NOT NULL,
    aggregate_id text        NOT NULL,
    payload      jsonb       NOT NULL,
    occurred_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_event_type_id_idx ON outbox_event (type, id);

CREATE TABLE outbox_delivery (
    event_id        uuid        NOT NULL REFERENCES outbox_event (id) ON DELETE CASCADE,
    consumer        text        NOT NULL,
    status          text        NOT NULL CHECK (status IN ('delivered', 'retrying', 'failed')),
    attempts        int         NOT NULL DEFAULT 0,
    next_attempt_at timestamptz,
    last_error      text,
    delivered_at    timestamptz,
    PRIMARY KEY (event_id, consumer)
);

-- +goose Down
DROP TABLE outbox_delivery;
DROP TABLE outbox_event;
```

- [ ] **Step 3: Write failing tests** in `dispatcher_test.go` (package `outbox_test`, database from `pgtest.New`):

| Test | Arrange | Assert |
|---|---|---|
| `TestInsertIsTransactional` | `Insert` inside a transaction that rolls back | No row in `outbox_event` |
| `TestDispatchDeliversOncePerConsumer` | Two consumers subscribed to `test.happened.v1`; one event inserted | `DispatchPending` calls each handler once; a second `DispatchPending` calls none; two `delivered` rows |
| `TestHandlerWritesCommitWithDelivery` | Handler inserts a row into a scratch table and returns nil | Row present and delivery `delivered` |
| `TestHandlerErrorRetriesWithBackoff` | Handler fails twice then succeeds; dispatcher clock injected | Status `retrying`, attempts 1 then 2, `next_attempt_at` = now + 1 s then + 2 s; third pass after the time `delivered`; the handler's scratch row from failed attempts is absent |
| `TestTenthFailureMarksFailed` | Handler always fails | After 10 attempts status `failed`; further passes do not call it |
| `TestOtherEventsKeepFlowing` | Event A fails, event B succeeds for the same consumer | B delivered while A is `retrying` |

```go
func TestDispatchDeliversOncePerConsumer(t *testing.T) {
	pool := pgtest.New(t)
	userID := pgtest.CreateUser(t, pool)
	d := outbox.NewDispatcher(pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	var a, b atomic.Int32
	d.Subscribe("consumer-a", "test.happened.v1", func(context.Context, pgx.Tx, outbox.Delivered) error { a.Add(1); return nil })
	d.Subscribe("consumer-b", "test.happened.v1", func(context.Context, pgx.Tx, outbox.Delivered) error { b.Add(1); return nil })
	insertEvent(t, pool, outbox.Event{Type: "test.happened.v1", UserID: userID, AggregateID: "x", Payload: map[string]int{"n": 1}})

	n, err := d.DispatchPending(t.Context())
	if err != nil || n != 2 {
		t.Fatalf("DispatchPending = %d, %v; want 2 deliveries", n, err)
	}
	if n, _ := d.DispatchPending(t.Context()); n != 0 {
		t.Fatalf("second pass delivered %d, want 0", n)
	}
	if a.Load() != 1 || b.Load() != 1 {
		t.Fatalf("calls a=%d b=%d, want 1 each", a.Load(), b.Load())
	}
}
```

Add `pgtest.CreateUser(t, pool) int64` (inserts an `identity_user` row with a unique email) to `internal/platform/postgres/pgtest`.

- [ ] **Step 4: Run** `make test`; expect compile failures in `outbox`.

- [ ] **Step 5: Implement.** `Insert` marshals `Payload` with `encoding/json/v2`, inserts the row and runs `SELECT pg_notify('outbox', '')` in the same transaction. `DispatchPending` iterates subscriptions in registration order; for each it selects up to 100 events:

```sql
SELECT e.id, e.type, e.user_id, e.aggregate_id, e.payload, e.occurred_at
FROM outbox_event e
LEFT JOIN outbox_delivery d ON d.event_id = e.id AND d.consumer = $2
WHERE e.type = $1
  AND (d.event_id IS NULL OR (d.status = 'retrying' AND d.next_attempt_at <= $3))
ORDER BY e.id
LIMIT 100;
```

For each event: begin; call the handler with the transaction; on success upsert the delivery as `delivered` and commit; on error roll back, then in a new statement upsert `retrying` with `attempts + 1`, `next_attempt_at = now + min(1s × 2^(attempts−1), 10m)`, `last_error`; at attempts = 10 set `failed`. `Run` opens a dedicated connection, `LISTEN outbox`, and loops: `DispatchPending`, then waits for a notification or 5 s; once per hour deletes events older than 30 days with no `retrying` or `failed` delivery. The dispatcher's clock is a field `now func() time.Time` set to `time.Now` by `NewDispatcher`; tests set it through an `export_test.go`.

- [ ] **Step 6: Wire** in `cmd/equori/main.go`: create the dispatcher after migrations, start `Run` in a goroutine bound to the server context, stop it on shutdown.

- [ ] **Step 7: Run** `make check`; expect PASS.

- [ ] **Step 8: Commit** `feat(platform): add transactional outbox with per-consumer delivery`.

### Task 2: Market data instruments and user-created event

**Files:**
- Create: `db/migrations/00003_marketdata.sql`, `db/queries/marketdata/instrument.sql`, `internal/marketdata/marketdata.go`, `internal/marketdata/internal/adapter/postgres/*.gen.go`, `internal/marketdata/marketdata_test.go`
- Modify: `sqlc.yaml`, `internal/identity/internal/adapter/postgres/repository.go`, `internal/identity/internal/app/service.go`, `internal/identity/identity_test.go`

**Interfaces:**
- Produces:
  - `marketdata.Instrument{Code string; Type string; Scale int; Name string}`
  - `func (m *Module) Instrument(ctx context.Context, code string) (Instrument, error)`; `marketdata.ErrUnknownInstrument`
  - Event `identity.user_created.v1` with payload `{"user_id": <int>, "email": "<string>"}`

- [ ] **Step 1: Migration** with the currencies of `platform/money`:

```sql
-- +goose Up
CREATE TABLE marketdata_instrument (
    code            text     PRIMARY KEY CHECK (code ~ '^[A-Z0-9.]{2,20}$'),
    instrument_type text     NOT NULL CHECK (instrument_type IN ('currency', 'stock', 'fii', 'etf', 'bdr', 'fixed_income', 'fund', 'crypto')),
    scale           smallint NOT NULL CHECK (scale BETWEEN 0 AND 12),
    name            text     NOT NULL
);

INSERT INTO marketdata_instrument (code, instrument_type, scale, name) VALUES
    ('ARS', 'currency', 2, 'Argentine peso'), ('AUD', 'currency', 2, 'Australian dollar'),
    ('BRL', 'currency', 2, 'Brazilian real'), ('CAD', 'currency', 2, 'Canadian dollar'),
    ('CHF', 'currency', 2, 'Swiss franc'), ('CLP', 'currency', 0, 'Chilean peso'),
    ('CNY', 'currency', 2, 'Chinese yuan'), ('COP', 'currency', 2, 'Colombian peso'),
    ('EUR', 'currency', 2, 'Euro'), ('GBP', 'currency', 2, 'Pound sterling'),
    ('JPY', 'currency', 0, 'Japanese yen'), ('MXN', 'currency', 2, 'Mexican peso'),
    ('PYG', 'currency', 0, 'Paraguayan guaraní'), ('USD', 'currency', 2, 'US dollar'),
    ('UYU', 'currency', 2, 'Uruguayan peso');

-- +goose Down
DROP TABLE marketdata_instrument;
```

- [ ] **Step 2: Test** `TestCurrenciesMatchMoneyPackage`: for every currency row, `money.ParseCurrency(code)` succeeds and `MinorUnits()` equals `scale`; and for every currency known to `money`, a row exists. Add an exported `money.Currencies() []Currency` (sorted) to make the reverse check possible, with its own unit test.

- [ ] **Step 3: Test** in `identity_test.go`: `TestCreateUserPublishesEvent`: after `CreateUser`, `outbox_event` holds one `identity.user_created.v1` row with the user id.

- [ ] **Step 4: Implement.** Module `marketdata` with the sqlc query `GetInstrument`. In identity, `Repository.CreateUser` runs `pgx.BeginFunc` on the pool, inserts the user and calls `outbox.Insert` in the same transaction (the repository keeps a `*pgxpool.Pool` next to its `Queries`).

- [ ] **Step 5: Run** `make gen && make check`; expect PASS.

- [ ] **Step 6: Commit** `feat(marketdata): add currency instruments` and `feat(identity): publish user_created events` (two commits).

### Task 3: Ledger schema with database invariants

**Files:**
- Create: `db/migrations/00004_ledger.sql`, `internal/ledger/schema_test.go`

**Interfaces:**
- Produces: tables used by Tasks 5–9, exactly as below.

- [ ] **Step 1: Write the migration.**

```sql
-- +goose Up
CREATE TABLE ledger_settings (
    user_id       bigint PRIMARY KEY REFERENCES identity_user (id) ON DELETE CASCADE,
    base_currency text   NOT NULL REFERENCES marketdata_instrument (code)
);

CREATE TABLE ledger_institution (
    id      uuid   NOT NULL DEFAULT uuidv7(),
    user_id bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name    text   NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    code    text,
    PRIMARY KEY (id),
    UNIQUE (user_id, id)
);
CREATE UNIQUE INDEX ledger_institution_name_key ON ledger_institution (user_id, lower(name));

CREATE TABLE ledger_payee (
    id      uuid   NOT NULL DEFAULT uuidv7(),
    user_id bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name    text   NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    PRIMARY KEY (id),
    UNIQUE (user_id, id)
);
CREATE UNIQUE INDEX ledger_payee_name_key ON ledger_payee (user_id, lower(name));

CREATE TABLE ledger_account (
    id                    uuid   NOT NULL DEFAULT uuidv7(),
    user_id               bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name                  text   NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    account_class         text   NOT NULL CHECK (account_class IN ('asset', 'liability', 'equity', 'income', 'expense')),
    kind                  text   CHECK (kind IN ('checking', 'savings', 'cash', 'wallet', 'benefit', 'reserve', 'brokerage', 'receivable', 'credit_card', 'loan', 'payable')),
    instrument            text   NOT NULL REFERENCES marketdata_instrument (code),
    parent_id             uuid,
    institution_id        uuid,
    counterparty_payee_id uuid,
    opened_on             date   NOT NULL,
    closed_on             date,
    yield_mode            text   NOT NULL DEFAULT 'none' CHECK (yield_mode IN ('none', 'auto')),
    system_role           text   CHECK (system_role IN ('opening_balances', 'adjustments', 'uncategorized_expense', 'uncategorized_income', 'yield', 'discounts', 'interest', 'taxes', 'fees', 'realized_gains', 'realized_losses')),
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, parent_id) REFERENCES ledger_account (user_id, id),
    FOREIGN KEY (user_id, institution_id) REFERENCES ledger_institution (user_id, id),
    FOREIGN KEY (user_id, counterparty_payee_id) REFERENCES ledger_payee (user_id, id),
    CHECK (closed_on IS NULL OR closed_on >= opened_on),
    CHECK (
        (account_class IN ('asset', 'liability') AND kind IS NOT NULL) OR
        (account_class IN ('equity', 'income', 'expense') AND kind IS NULL)
    ),
    CHECK (
        kind IS NULL OR
        (account_class = 'asset' AND kind IN ('checking', 'savings', 'cash', 'wallet', 'benefit', 'reserve', 'brokerage', 'receivable', 'loan')) OR
        (account_class = 'liability' AND kind IN ('credit_card', 'loan', 'payable'))
    )
);
CREATE UNIQUE INDEX ledger_account_system_role_key ON ledger_account (user_id, system_role) WHERE system_role IS NOT NULL;

CREATE TABLE ledger_tag (
    id      uuid   NOT NULL DEFAULT uuidv7(),
    user_id bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name    text   NOT NULL CHECK (name ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    UNIQUE (user_id, name)
);

CREATE TABLE ledger_transaction (
    id                 uuid   NOT NULL DEFAULT uuidv7(),
    user_id            bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    date               date   NOT NULL,
    description        text   NOT NULL CHECK (length(description) <= 500),
    payee_id           uuid,
    balancing_currency text   NOT NULL REFERENCES marketdata_instrument (code),
    origin             text   NOT NULL CHECK (origin IN ('manual', 'import', 'schedule', 'system')),
    version            int    NOT NULL DEFAULT 1 CHECK (version >= 1),
    voided_at          timestamptz,
    void_reason        text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, payee_id) REFERENCES ledger_payee (user_id, id)
);
CREATE INDEX ledger_transaction_list_idx ON ledger_transaction (user_id, date DESC, id DESC);
CREATE INDEX ledger_transaction_payee_idx ON ledger_transaction (user_id, payee_id, date);

CREATE TABLE ledger_transaction_version (
    transaction_id uuid        NOT NULL REFERENCES ledger_transaction (id) ON DELETE CASCADE,
    version        int         NOT NULL,
    snapshot       jsonb       NOT NULL,
    reason         text        NOT NULL,
    replaced_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (transaction_id, version)
);

CREATE TABLE ledger_transaction_tag (
    user_id        bigint NOT NULL,
    transaction_id uuid   NOT NULL,
    tag_id         uuid   NOT NULL,
    PRIMARY KEY (transaction_id, tag_id),
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, tag_id) REFERENCES ledger_tag (user_id, id) ON DELETE CASCADE
);

CREATE TABLE ledger_posting (
    id                  uuid     NOT NULL DEFAULT uuidv7(),
    user_id             bigint   NOT NULL,
    transaction_id      uuid     NOT NULL,
    account_id          uuid     NOT NULL,
    position            smallint NOT NULL CHECK (position >= 0),
    amount              bigint   NOT NULL CHECK (amount <> 0 AND abs(amount) <= 9007199254740991),
    weight              bigint   NOT NULL CHECK (weight <> 0 AND abs(weight) <= 9007199254740991),
    booked_on           date     NOT NULL,
    settled_on          date,
    status              text     NOT NULL CHECK (status IN ('pending', 'cleared', 'reconciled')),
    original_amount     bigint,
    original_instrument text REFERENCES marketdata_instrument (code),
    memo                text CHECK (length(memo) <= 500),
    PRIMARY KEY (id),
    UNIQUE (transaction_id, position),
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id),
    CHECK ((original_amount IS NULL) = (original_instrument IS NULL))
);
CREATE INDEX ledger_posting_booked_idx ON ledger_posting (account_id, booked_on) INCLUDE (amount, weight);
CREATE INDEX ledger_posting_settled_idx ON ledger_posting (account_id, coalesce(settled_on, booked_on)) INCLUDE (amount);
CREATE INDEX ledger_posting_transaction_idx ON ledger_posting (transaction_id);

CREATE TABLE ledger_link (
    id                  uuid   NOT NULL DEFAULT uuidv7(),
    user_id             bigint NOT NULL,
    from_transaction_id uuid   NOT NULL,
    to_transaction_id   uuid   NOT NULL,
    link_type           text   NOT NULL CHECK (link_type IN ('refund_of', 'reimbursement_of', 'cancellation_of', 'anticipation_of', 'chargeback_of', 'correction_of')),
    PRIMARY KEY (id),
    UNIQUE (from_transaction_id, to_transaction_id, link_type),
    FOREIGN KEY (user_id, from_transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, to_transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    CHECK (from_transaction_id <> to_transaction_id)
);
CREATE INDEX ledger_link_to_idx ON ledger_link (to_transaction_id);

-- I01, I02: checked at commit for every transaction whose postings changed.
-- +goose StatementBegin
CREATE FUNCTION ledger_check_transaction_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    tx_id uuid := coalesce(NEW.transaction_id, OLD.transaction_id);
    voided boolean;
    n int;
    total numeric;
BEGIN
    SELECT voided_at IS NOT NULL INTO voided FROM ledger_transaction WHERE id = tx_id;
    IF voided IS NULL OR voided THEN
        RETURN NULL;
    END IF;
    SELECT count(*), coalesce(sum(weight), 0) INTO n, total FROM ledger_posting WHERE transaction_id = tx_id;
    IF n < 2 THEN
        RAISE EXCEPTION 'transaction % has % postings; at least 2 required', tx_id, n USING ERRCODE = 'check_violation';
    END IF;
    IF total <> 0 THEN
        RAISE EXCEPTION 'transaction % is unbalanced by %', tx_id, total USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;
-- +goose StatementEnd
CREATE CONSTRAINT TRIGGER ledger_posting_balance
    AFTER INSERT OR UPDATE OR DELETE ON ledger_posting
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION ledger_check_transaction_balance();

-- I09: the account is open on the booking date; same check on account close.
-- +goose StatementBegin
CREATE FUNCTION ledger_check_account_open() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    a record;
BEGIN
    SELECT opened_on, closed_on INTO a FROM ledger_account WHERE id = NEW.account_id;
    IF NEW.booked_on < a.opened_on OR (a.closed_on IS NOT NULL AND NEW.booked_on > a.closed_on) THEN
        RAISE EXCEPTION 'account % is not open on %', NEW.account_id, NEW.booked_on USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER ledger_posting_account_open
    BEFORE INSERT OR UPDATE OF account_id, booked_on ON ledger_posting
    FOR EACH ROW EXECUTE FUNCTION ledger_check_account_open();

-- booked_on mirrors the transaction date.
-- +goose StatementBegin
CREATE FUNCTION ledger_sync_booked_on() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ledger_posting SET booked_on = NEW.date WHERE transaction_id = NEW.id AND booked_on <> NEW.date;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER ledger_transaction_date_sync
    AFTER UPDATE OF date ON ledger_transaction
    FOR EACH ROW EXECUTE FUNCTION ledger_sync_booked_on();

-- Voiding re-checks nothing; un-voiding is not allowed.
-- +goose StatementBegin
CREATE FUNCTION ledger_forbid_unvoid() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.voided_at IS NOT NULL AND NEW.voided_at IS NULL THEN
        RAISE EXCEPTION 'transaction % is voided and cannot be restored', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER ledger_transaction_unvoid
    BEFORE UPDATE OF voided_at ON ledger_transaction
    FOR EACH ROW EXECUTE FUNCTION ledger_forbid_unvoid();

-- +goose Down
DROP TABLE ledger_link, ledger_posting, ledger_transaction_tag, ledger_transaction_version,
    ledger_transaction, ledger_tag, ledger_account, ledger_payee, ledger_institution, ledger_settings;
DROP FUNCTION ledger_check_transaction_balance, ledger_check_account_open, ledger_sync_booked_on, ledger_forbid_unvoid;
```

- [ ] **Step 2: Write failing database tests** in `schema_test.go` (package `ledger_test`, raw SQL through `pgtest.New`), N04:

| Test | Operation | Expected |
|---|---|---|
| `TestDBRejectsUnbalancedTransaction` | Insert transaction + postings +100 and −90 in one tx | Commit fails, `check_violation`, message contains "unbalanced" |
| `TestDBRejectsSinglePosting` | One posting | Commit fails, "at least 2" |
| `TestDBAcceptsBalancedTransaction` | +100 / −100 | Commit succeeds |
| `TestDBIgnoresVoidedTransaction` | Void a balanced transaction, then delete one posting in the same tx | Commit succeeds |
| `TestDBRejectsPostingOutsideOpenPeriod` | Account opened 2026-02-01, posting booked 2026-01-31 | Insert fails |
| `TestDBRejectsCrossUserAccount` | User B's posting referencing user A's account | Foreign key violation |
| `TestDBRejectsClassKindMismatch` | `expense` account with kind `checking`; `liability` with kind `cash` | Check violation |
| `TestDBForbidsUnvoid` | Set `voided_at` back to NULL | Check violation |
| `TestDBBookedOnFollowsDate` | Update transaction date | Every posting `booked_on` equals the new date |

- [ ] **Step 3: Run** `make test`; failing tests fail for the expected reasons, then pass once the migration is in place (the migration is the implementation).

- [ ] **Step 4: Run** `make check`; expect PASS.

- [ ] **Step 5: Commit** `feat(ledger): add ledger schema with balance and open-period invariants`.

**Slice A ends here: write the checkpoint (`.claude/progress/current.md`) and stop.**

---

## Slice B (Tasks 4–6): ledger domain and application

### Task 4: Ledger domain model

**Files:**
- Create: `internal/ledger/internal/domain/account.go`, `transaction.go`, `errors.go`, `account_test.go`, `transaction_test.go`, `transaction_property_test.go`

**Interfaces:**
- Produces:

```go
type Class string   // ClassAsset, ClassLiability, ClassEquity, ClassIncome, ClassExpense
type Kind string    // KindChecking ... KindPayable
type SystemRole string

type Account struct {
	ID, ParentID, InstitutionID, CounterpartyID uuid.UUID // zero = absent
	UserID     int64
	Name       string
	Class      Class
	Kind       Kind
	Instrument money.Currency // P1 accepts currencies only
	OpenedOn   time.Time      // accounting date (ADR 005)
	ClosedOn   *time.Time
	YieldMode  string
	SystemRole SystemRole
}
func NewAccount(a Account) (Account, error)            // validates class/kind pairs, name, defaults yield mode
func (a Account) IsOpenOn(d time.Time) bool
func ValidateParent(child, parent Account) error       // same class; balance accounts same institution and instrument

type PostingStatus string // pending, cleared, reconciled
type Posting struct {
	ID        uuid.UUID
	AccountID uuid.UUID
	Amount    money.Money // in the account currency
	Weight    money.Money // in the balancing currency
	Status    PostingStatus
	SettledOn *time.Time
	Original  *money.Money
	Memo      string
}
type LinkType string
type Link struct { Type LinkType; Target uuid.UUID }

type Transaction struct {
	ID                uuid.UUID
	UserID            int64
	Date              time.Time
	Description       string
	PayeeID           uuid.UUID
	BalancingCurrency money.Currency
	Origin            string
	Version           int
	VoidedAt          *time.Time
	Postings          []Posting
	Tags              []string
	Links             []Link
}
func NewTransaction(t Transaction, accounts map[uuid.UUID]Account) (Transaction, error)
func (t Transaction) Correct(next Transaction, expectedVersion int, accounts map[uuid.UUID]Account) (Transaction, error)
func (t Transaction) Void(at time.Time, reason string) (Transaction, error)
```

Errors (`errors.go`): `ErrValidation` (wrapped by `*FieldError{Field, Message string}`), `ErrUnbalanced`, `ErrTooFewPostings`, `ErrAccountClosed`, `ErrVersionConflict`, `ErrVoided`, `ErrReconciled`, `ErrCurrencyMismatch`.

- [ ] **Step 1: Write failing tests** (`account_test.go`, table-driven):

| Case | Input | Expected |
|---|---|---|
| Valid checking | asset/checking/BRL | ok, yield `none` |
| Reserve default yield | asset/reserve | yield `auto` |
| Kind on category | expense/checking | `FieldError{kind}` |
| Missing kind on balance account | asset/"" | `FieldError{kind}` |
| Liability with asset kind | liability/cash | `FieldError{kind}` |
| Parent of different class | expense child, income parent | error |
| Balance parent at other institution | reserve under checking of another institution | error |
| Open period | opened 2026-01-01, closed 2026-06-30 | `IsOpenOn` false for 2025-12-31 and 2026-07-01, true for both bounds |

- [ ] **Step 2: Write failing tests** (`transaction_test.go`):

| Case | Expected |
|---|---|
| Two BRL postings +230 / −230 | ok; weights equal amounts |
| +100 / −90 | `ErrUnbalanced` |
| One posting | `ErrTooFewPostings` |
| Posting amount 0 | `FieldError{postings[0].amount}` |
| Weight differs from amount on a BRL account with BRL balancing currency | `ErrCurrencyMismatch` |
| USD account posting +1,000.00 USD weight +5,483.00 BRL, BRL −5,483.00 | ok (DM1) |
| USD posting with weight sign opposite to amount | `FieldError{weight}` |
| Posting on account closed before the date | `ErrAccountClosed` |
| More than 500 postings | `FieldError{postings}` (N26) |
| Description longer than 500 | `FieldError{description}` |
| Correct with `expectedVersion` ≠ `Version` | `ErrVersionConflict` |
| Correct a voided transaction | `ErrVoided` |
| Correct when any posting is `reconciled` | `ErrReconciled` |
| Correct ok | `Version` + 1, ID unchanged |
| Void twice | `ErrVoided` |
| Tags normalized | `"Trip Lisbon"` → `"trip-lisbon"`; invalid characters rejected |

- [ ] **Step 3: Write the randomized test** (`transaction_property_test.go`, N02) with `math/rand/v2` and fixed seeds 1–200: generate 2–8 postings with random non-zero amounts on random open accounts; with probability 0.5 make the last posting balance the rest. Assert: `NewTransaction` succeeds if and only if the sum of weights is zero and every amount is within ±`money.MaxAmount`; on success the stored postings are identical to the input.

- [ ] **Step 4: Run** `go test ./internal/ledger/...`; expect FAIL (undefined).

- [ ] **Step 5: Implement** the types and rules exactly as the tables state. Weight rule: when `posting account currency == BalancingCurrency`, `Weight` defaults to `Amount` and any other value returns `ErrCurrencyMismatch`; when different, `Weight` is required, non-zero, same sign as `Amount` and in `BalancingCurrency`. Balance check sums weights with `money.Money.Add`.

- [ ] **Step 6: Run** tests; expect PASS. `make check` PASS (depguard: `domain` imports stdlib, `platform/money` and `github.com/google/uuid`; add `github.com/google/uuid` to the domain allow list in `.golangci.yml` in this task).

- [ ] **Step 7: Commit** `feat(ledger): add account and transaction domain model`.

### Task 5: Ledger application, provisioning and repository

**Files:**
- Create: `internal/ledger/ledger.go`, `internal/ledger/internal/app/{ports,provisioning,accounts,transactions}.go`, `internal/ledger/internal/adapter/postgres/repository.go`, `db/queries/ledger/{account,transaction,reference}.sql`, `internal/ledger/app_test.go`
- Modify: `sqlc.yaml`, `cmd/equori/main.go`

**Interfaces:**
- Consumes: `outbox.Insert`, `outbox.Dispatcher.Subscribe`, `marketdata.Module.Instrument`, domain of Task 4.
- Produces (app):

```go
type Repository interface {
	InTx(ctx context.Context, fn func(Repository) error) error
	Publish(ctx context.Context, e outbox.Event) error // valid only inside InTx
	Settings(ctx context.Context, userID int64) (Settings, error)
	SaveSettings(ctx context.Context, s Settings) error
	Account(ctx context.Context, userID int64, id uuid.UUID) (domain.Account, error)
	Accounts(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]domain.Account, error)
	ListAccounts(ctx context.Context, userID int64) ([]domain.Account, error)
	SaveAccount(ctx context.Context, a domain.Account) (domain.Account, error)
	Transaction(ctx context.Context, userID int64, id uuid.UUID) (domain.Transaction, error)
	LockTransaction(ctx context.Context, userID int64, id uuid.UUID) (domain.Transaction, error) // SELECT ... FOR UPDATE
	InsertTransaction(ctx context.Context, t domain.Transaction) (domain.Transaction, error)
	ReplaceTransaction(ctx context.Context, prev, next domain.Transaction, reason string) error // writes version row, replaces postings, tags, links
	ListTransactions(ctx context.Context, q TransactionQuery) ([]domain.Transaction, error)
	// institutions, payees, tags: Save*/List* with the same shape
}
type TransactionQuery struct {
	UserID    int64
	AccountID uuid.UUID // zero = all
	PayeeID   uuid.UUID
	Tag       string
	From, To  *time.Time
	After     *TransactionCursor // (Date, ID) of the last row of the previous page
	Limit     int                // fetches Limit+1 (page.Trim)
}
type TransactionCursor struct { Date time.Time `json:"d"`; ID uuid.UUID `json:"i"` }

func (s *Service) Provision(ctx context.Context, userID int64, baseCurrency money.Currency) error // idempotent
func (s *Service) RecordTransaction(ctx context.Context, userID int64, t domain.Transaction) (domain.Transaction, error)
func (s *Service) CorrectTransaction(ctx context.Context, userID int64, id uuid.UUID, expectedVersion int, next domain.Transaction, reason string) (domain.Transaction, error)
func (s *Service) VoidTransaction(ctx context.Context, userID int64, id uuid.UUID, reason string) error
```

- Events published (payload JSON keys in snake_case): `ledger.transaction_recorded.v1`, `ledger.transaction_corrected.v1`, `ledger.transaction_voided.v1` with `{"transaction_id","date","previous_date","account_ids"}` (`previous_date` only on corrections, the earlier of the two dates matters to Reporting); `ledger.account_opened.v1`, `ledger.account_closed.v1` with `{"account_id"}`.

- [ ] **Step 1: Write failing integration tests** (`app_test.go`, through the module API against `pgtest`):

| Test | Expected |
|---|---|
| `TestProvisionCreatesSystemAccounts` | After `identity.user_created.v1` is dispatched: settings with base BRL; one account per system role with the right class (`opening_balances`, `adjustments` equity; `uncategorized_expense`, `interest`, `taxes`, `fees`, `realized_losses` expense; `uncategorized_income`, `yield`, `discounts`, `realized_gains` income); running the handler twice creates nothing new |
| `TestRecordTransactionPublishesEvent` | Transaction stored with postings in order; one `ledger.transaction_recorded.v1` |
| `TestRecordRejectsForeignAccount` | Account id of another user → `ErrUnknownAccount` (field `postings[i].account_id`) |
| `TestCorrectWritesVersion` | Version 2 stored; `ledger_transaction_version` holds version 1 snapshot with the old postings |
| `TestConcurrentCorrectionsConflict` | Two goroutines correct with expected version 1; exactly one succeeds, the other gets `ErrVersionConflict` (Review Focus 1) |
| `TestVoidKeepsHistory` | Voided transaction still returned by `Transaction`; `VoidTransaction` again → `ErrVoided` |
| `TestCloseAccountRequiresZeroBalance` | Closing with balance ≠ 0 → `ErrNonZeroBalance` |
| `TestListTransactionsCursor` | 7 transactions, 5 on the same date; pages of 2 return each id once, in `date DESC, id DESC` order (Review Focus 3) |

- [ ] **Step 2: Run**; expect FAIL.

- [ ] **Step 3: Implement.** Queries in `db/queries/ledger/*.sql` (sqlc). Repository `InTx` per ADR 005 (`pgx.BeginFunc`, nested savepoints). `RecordTransaction`: `InTx` → load accounts of all postings with `Accounts` (missing id → `ErrUnknownAccount`) → `domain.NewTransaction` → `InsertTransaction` → `Publish`. `CorrectTransaction`: `InTx` → `LockTransaction` → `Correct` → `ReplaceTransaction` → `Publish`. Map `pgconn.PgError` foreign key violation on `ledger_posting` to `ErrUnknownAccount`. Module root `ledger.New(pool, dispatcher, marketdata, log)` subscribes `ledger-provisioning` to `identity.user_created.v1` and calls `Provision` with the handler's transaction (repository constructed on the `pgx.Tx`).

- [ ] **Step 4: Run** `make gen && make check`; expect PASS.

- [ ] **Step 5: Commit** `feat(ledger): record, correct and void transactions with provisioning`.

### Task 6: Balances

**Files:**
- Create: `internal/ledger/internal/app/balances.go`, `db/queries/ledger/balance.sql`, `internal/ledger/balance_test.go`

**Interfaces:**
- Produces:

```go
type Basis string // BasisBooked, BasisSettled
type Balance struct {
	AccountID uuid.UUID
	Date      time.Time
	Basis     Basis
	Amount    money.Money // account currency; parent accounts: sum of descendants
}
func (s *Service) BalanceAt(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis Basis) (Balance, error)
```

- [ ] **Step 1: Failing tests:**

| Test | Expected |
|---|---|
| `TestBalanceBookedVsSettled` | S03 debit case: booked balance at 2026-10-18 lower by 80.00; settled balance unchanged until 2026-10-19 |
| `TestBalanceExcludesVoided` | Void removes the transaction from the balance (Review Focus 4) |
| `TestParentBalanceSumsChildren` | Nubank parent = checking postings + reserve postings; parent with own postings rejected at record time |
| `TestBalanceAtDateIncludesThatDay` | Posting on D counts in the balance at D, not at D − 1 |

- [ ] **Step 2: Run**; expect FAIL.

- [ ] **Step 3: Implement** with one query per basis over `ledger_posting` joined to non-voided transactions, filtering the account and its descendants (recursive CTE on `parent_id`). Add to `domain.NewTransaction` the rule "postings on parent balance accounts are rejected" (`FieldError{postings[i].account_id}`), with its unit test in `transaction_test.go`. Measure N06 with a benchmark `BenchmarkBalanceAt` on 150,000 seeded postings: below 50 ms per call.

- [ ] **Step 4: Run** `make check`; expect PASS.

- [ ] **Step 5: Commit** `feat(ledger): compute balances by booked and settled date`.

**Slice B ends here: write the checkpoint and stop.**

---

## Slice C (Tasks 7–9): API, series and acceptance

### Task 7: Ledger HTTP API

**Files:**
- Modify: `api/openapi.yaml`, `cmd/equori/main.go`
- Create: `internal/ledger/internal/adapter/httpapi/{oapi-codegen.yaml,server.go,errors.go}`, `internal/ledger/api_test.go`

**Interfaces:**
- Endpoints (tag `ledger`, all under `/api/v1`):

| Method and path | Operation |
|---|---|
| `GET /settings`, `PUT /settings` | Base currency. Changeable only while the user has no transaction; the change also sets the instrument of every system account. Otherwise 409 `settings_locked`. |
| `GET /institutions`, `POST /institutions` | |
| `GET /payees`, `POST /payees` | |
| `GET /tags` | |
| `GET /accounts`, `POST /accounts`, `GET /accounts/{id}`, `PATCH /accounts/{id}` (name, parent, institution) | |
| `POST /accounts/{id}/close` | Body `{"closed_on"}` |
| `GET /accounts/{id}/balance?date=&basis=` | `basis` `booked` (default) or `settled` |
| `GET /transactions?limit=&cursor=&account_id=&payee_id=&tag=&from=&to=` | Page `{"items","next_cursor"}` |
| `POST /transactions` | Body: date, description, payee_id, tags, postings[{account_id, amount{amount,currency}, weight?, status, settled_on?, memo?}], links[] |
| `GET /transactions/{id}` | Includes `version`, `voided_at` |
| `PUT /transactions/{id}` | Body as POST plus `expected_version` and `reason` |
| `POST /transactions/{id}/void` | Body `{"reason"}` |
| `GET /transactions/{id}/versions` | Previous versions |

- New problem codes added to the `Problem.code` description: `validation_failed` (422 with `errors[]`), `version_conflict` (409), `invalid_account` (422), `transaction_voided` (409), `posting_reconciled` (409), `not_found` (404), `account_not_empty` (409), `settings_locked` (409).

- [ ] **Step 1: Failing API tests** (`api_test.go`, HTTP harness like `identity_test.go`, logged in):

| Test | Expected |
|---|---|
| `TestCreateAccountAndRecordExpense` | 201 account; 201 transaction; `GET /accounts/{id}/balance` shows −120.00 |
| `TestValidationErrorsHaveFields` | Zero amount → 422 `validation_failed`, `errors[0].field = "postings[0].amount"`; amount 9007199254740992 → same code (Review Focus 5) |
| `TestForeignAccountIs422` | Account id of another user → 422 `invalid_account` (Review Focus 2) |
| `TestCorrectionConflictIs409` | Stale `expected_version` → 409 `version_conflict` |
| `TestPaginationTies` | 120 transactions on 3 dates, `limit=50`: 3 pages, 120 distinct ids (Review Focus 3) |
| `TestInvalidCursorIs400` | `cursor=abc` → 400 `invalid_request` |
| `TestUnauthenticated` | Every new route without session → 401 |

- [ ] **Step 2: Run**; expect FAIL.

- [ ] **Step 3: Implement** the OpenAPI paths and schemas (`Money`, `Posting`, `Transaction`, `TransactionPage`, `Account`, `Balance`), `make gen`, strict server handlers mapping domain errors in `errors.go` with `problem.Details` and field errors; cursors with `page.EncodeCursor(TransactionCursor)`.

- [ ] **Step 4: Run** `make gen && make check`; expect PASS.

- [ ] **Step 5: Commit** `feat(ledger): expose accounts, transactions and balances over HTTP`.

### Task 8: Reporting daily balance series

**Files:**
- Create: `db/migrations/00005_reporting.sql`, `db/queries/reporting/account_day.sql`, `internal/reporting/reporting.go`, `internal/reporting/internal/...`, `internal/reporting/reporting_test.go`
- Modify: `api/openapi.yaml` (tag `reporting`), `cmd/equori/main.go`

**Interfaces:**
- Consumes: ledger events of Task 5.
- Produces: `GET /api/v1/reports/balances?account_id=&from=&to=&basis=` → `{"items":[{"date","balance"}]}`, one item per day in `[from, to]`, max 3,660 days.
- Command: `equori reporting rebuild` (CLI subcommand) recomputes every account of every user.

- [ ] **Step 1: Migration:**

```sql
-- +goose Up
CREATE TABLE reporting_account_day (
    user_id         bigint NOT NULL,
    account_id      uuid   NOT NULL,
    date            date   NOT NULL,
    delta_booked    bigint NOT NULL,
    delta_settled   bigint NOT NULL,
    balance_booked  bigint NOT NULL,
    balance_settled bigint NOT NULL,
    PRIMARY KEY (account_id, date),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE reporting_account_day;
```

Rows exist only for dates with a non-zero delta in either basis; the API fills the days between rows with the previous balance.

- [ ] **Step 2: Failing tests:**

| Test | Expected |
|---|---|
| `TestSeriesFollowsRecordedTransactions` | After dispatch, the series equals `BalanceAt` for every day of the range |
| `TestSeriesRebuildsFromEarliestChangedDate` | Correcting a transaction from 2026-10-20 to 2026-10-10 updates every day from 2026-10-10 |
| `TestSeriesDropsVoided` | Void → series back to previous values (Review Focus 4) |
| `TestRebuildIsIdempotent` | Running the rebuild twice yields identical rows |
| `TestSeriesRangeLimit` | 3,661 days → 400 `invalid_request` |

- [ ] **Step 3: Implement.** Handler `reporting-series` for the three transaction events: in the handler transaction, for each account in `account_ids`, delete rows from `min(date, previous_date)` and recompute them from `ledger_posting` (read-only query on Ledger tables, ADR 002). The rebuild command does the same from the account's first posting.

- [ ] **Step 4: Run** `make gen && make check`; expect PASS. Benchmark N08: rebuild of the 150,000-posting dataset below 60 s.

- [ ] **Step 5: Commit** `feat(reporting): add daily balance series`.

### Task 9: Acceptance scenarios and documentation

**Files:**
- Create: `internal/ledger/scenarios_test.go`
- Modify: `docs/domain/09-roadmap.md` (calendar moved to P2), `CLAUDE.md` (module list), `README.md` (API overview), `.claude/progress/current.md`

- [ ] **Step 1: Write the scenarios** through the HTTP API, with the fixture of chapter 6 (6.1) limited to P1 accounts, asserting the exact postings and balances of: S01, S02, S03 (all five payments, including booked vs settled), S04 (including the unchanged Nubank parent balance), S19, S20, S23 checking part. Each scenario is one subtest named after its id: `t.Run("S03", ...)`.

- [ ] **Step 2: Run**; scenarios fail only where Tasks 1–8 left a gap; fix the gap in the owning package with a unit test first.

- [ ] **Step 3: Update docs:** roadmap P1 scope without the calendar and P2 with it; CLAUDE.md layout lists `ledger`, `marketdata`, `reporting`; README lists the API groups.

- [ ] **Step 4: Run** `make check`; expect PASS. Push and confirm CI green.

- [ ] **Step 5: Commit** `test(ledger): add P1 acceptance scenarios` and `docs: update roadmap and module list for P1`.

**Slice C ends here: write the checkpoint and stop. P1 exit criterion (chapter 9): scenarios pass; N02 and N04 for I01, I02, I09.**
