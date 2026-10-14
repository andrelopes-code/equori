# ADR 005: Cross-cutting conventions for business modules

- Status: accepted
- Date: 2026-10-14

These conventions apply to every business module (`ledger`, `budget`, `reporting` and later ones).

## 1. Database transactions

A use case that writes more than one row atomically runs inside one database transaction. The port exposes it; `app` never imports `pgx`.

```go
// app
type Repository interface {
	InTx(ctx context.Context, fn func(Repository) error) error
	// ...
}

// adapter/postgres
type db interface {
	DBTX
	Begin(ctx context.Context) (pgx.Tx, error)
}

type Repository struct {
	db db
	q  *Queries
}

func (r *Repository) InTx(ctx context.Context, fn func(app.Repository) error) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		return fn(&Repository{db: tx, q: r.q.WithTx(tx)})
	})
}
```

- `fn` returning an error rolls back; returning nil commits.
- Nested `InTx` calls become savepoints (`pgx.Tx.Begin`).
- A transaction never spans modules (ADR 002).

## 2. Money

Package `internal/platform/money` (stdlib only) is the shared kernel for amounts.

- `money.Money`: `int64` amount in minor units + `money.Currency` (ISO 4217). Fields are unexported; values are built with `money.New`.
- Supported currencies and their minor units are listed in `money`. An unlisted code is rejected.
- `|amount| ≤ 2^53 − 1` (`money.MaxAmount`). The bound keeps amounts exact as JSON numbers in JavaScript and makes `int64` overflow impossible in `Add`/`Sub`.
- Arithmetic across currencies returns `money.ErrCurrencyMismatch`. Conversion between currencies is a domain operation with an explicit rate, never implicit.
- Database: `bigint` amount + `char(3)` currency (ADR 001).
- API: `{"amount": 1234, "currency": "BRL"}` — integer minor units. Clients format for display.

## 3. Dates and time zone

- Instants (`created_at`, `expires_at`) are `time.Time` in UTC, stored as `timestamptz`.
- Accounting dates (transaction date, budget month) are calendar dates, stored as `date`. In Go they are `time.Time` at 00:00 UTC; `clock.DateOf` is the only constructor from an instant.
- The instance time zone comes from `EQUORI_TIMEZONE` (IANA name, default `UTC`). "Today" and month boundaries are computed in it with `clock.Clock.Today`.
- API: instants as RFC 3339 with `Z`; dates as `YYYY-MM-DD` (`format: date`).
- The binary embeds the time zone database (`time/tzdata`).

## 4. List endpoints

- Cursor (keyset) pagination: `GET /api/v1/<resource>?limit=50&cursor=<opaque>`.
- `limit`: default 50, maximum 200 (`page.DefaultLimit`, `page.MaxLimit`). Out-of-range values return 400 `invalid_request`.
- `cursor`: opaque base64url string produced by `page.EncodeCursor` from the sort key of the last returned row. Clients never build or parse it. An invalid cursor returns 400 `invalid_request`.
- Queries order by a unique key (for example `date DESC, id DESC`), fetch `limit + 1` rows and pass them to `page.Trim` to compute `next_cursor`.
- Response body: `{"items": [...], "next_cursor": "..."}`; `next_cursor` is absent on the last page.
- Filters are query parameters named after the field (`account_id`, `from`, `to`). Ranges are inclusive dates.
