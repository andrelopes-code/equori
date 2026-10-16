# equori

Self-hosted personal finance manager.

Status: early development. No features yet.

API contract: [api/openapi.yaml](api/openapi.yaml). Security reports: [SECURITY.md](SECURITY.md).

## Run

```sh
POSTGRES_PASSWORD=change-me docker compose up -d
```

The app listens on `http://localhost:8080`. `GET /healthz` returns `200` when the database is reachable.

API groups under `/api/v1` (contract: [api/openapi.yaml](api/openapi.yaml)): session and current user; settings; institutions, payees and tags; accounts and categories with balances; transactions with corrections, voids and version history; credit cards (billing cycle rules, credit limits, cards, statements, installment purchases, statement payments and financing, refunds, cancellations, anticipations, disputes, commitments); reconciliation (balance assertions with automatic yield, difference resolution, statement reconciliation, unlock); transaction attachments; file import (CSV profiles, OFX and CSV imports, import batches, review of external records); classification (categorization rules and their order, payee aliases, rule suggestions, running rules on uncategorized transactions, categorization method per transaction and statistics, `POST /transactions/{id}/categorize`); transfers (`POST /transactions/{id}/transfer`, which pairs the imported sides of one transfer, and the rule actions `transfer` and `mark_reimbursable`); the Brazilian banking calendar (`/calendars/br_banking/holidays`); daily balance series (`/reports/balances`). Derived series can be recomputed with `docker compose exec app /equori reporting rebuild`.

API conventions ([ADR 007](docs/adr/007-api-conventions.md)): every request is validated against `api/openapi.yaml`, and a request outside the contract returns 400 `invalid_request` listing each invalid field; domain rule failures return 422. Errors are RFC 9457 problems with a stable `code` ([ADR 004](docs/adr/004-api-errors.md)). Amounts are `{"amount": <minor units>, "currency": "BRL"}`. Lists that grow take `limit` and `cursor` and return `next_cursor`. Creating a record returns 201 with `Location`; a state change (`void`, `close`, `unlock`, `resolve`, `reconcile`) returns 200 with the updated resource.

Create the first admin (the password is prompted without echo):

```sh
docker compose exec app /equori user create --email you@example.com --admin
```

| Variable | Default | Description |
|---|---|---|
| `EQUORI_DATABASE_URL` | set by `compose.yaml` | PostgreSQL connection URL |
| `EQUORI_HTTP_ADDR` | `:8080` | HTTP listen address |
| `EQUORI_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `EQUORI_TIMEZONE` | `UTC` | IANA time zone for "today" and month boundaries, e.g. `America/Sao_Paulo` |
| `EQUORI_INSECURE_COOKIES` | `false` | `true` drops the `Secure` cookie attribute; required to log in over plain HTTP from another host |
| `POSTGRES_PASSWORD` | `equori` | Database password used by `compose.yaml` |

Data lives in the `pgdata` Docker volume. Back it up with:

```sh
docker compose exec db pg_dump -U equori equori > equori.sql
```

Backup and restore: [docs/operations/backup.md](docs/operations/backup.md).

The Postgres major version is pinned to 18. To upgrade the major version, dump the database, recreate the volume with the new image and restore the dump.

## Development

Requirements: Go 1.27, Docker, make.

```sh
make hooks    # pre-commit runs make check
make db-up    # local Postgres on 127.0.0.1:54329 (EQUORI_DEV_DB_PORT)
make dev      # run the app
make gen      # regenerate sqlc and oapi-codegen output
make check    # format, tidy and codegen checks, lint, test (starts Postgres)
```

## License

MIT
