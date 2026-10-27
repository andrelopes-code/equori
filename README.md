# equori

Self-hosted personal finance manager.

Status: early development. The HTTP API covers the ledger, credit cards, reconciliation, file import, classification, Pluggy synchronization, planning (schedules, budgets, goals, projections), currencies and investments (prices, trades, income, positions); the web interface is a shell.

API contract: [api/openapi.yaml](api/openapi.yaml). Security reports: [SECURITY.md](SECURITY.md).

## Run

```sh
curl -fsSLO https://github.com/andrelopes-code/equori/releases/latest/download/compose.yaml
POSTGRES_PASSWORD=change-me docker compose up -d
```

The downloaded compose.yaml names the image of its release; a newer release ships its own.

Archives: each release attaches `equori_<version>_<os>_<arch>.tar.gz` for Linux and macOS and `SHA256SUMS`. The binary needs `EQUORI_DATABASE_URL` pointing to PostgreSQL 18 or later. Verify an archive with:

```sh
gh attestation verify equori_<version>_linux_amd64.tar.gz --repo andrelopes-code/equori
```

### Windows

Each release attaches `equori_<version>_windows_amd64_setup.exe` for Windows 10 (1803 or later) and Windows 11, on x64 and on Arm through emulation. The installer holds PostgreSQL 18 and installs the service `equori`, which starts with Windows and listens on `http://127.0.0.1:8080`. It asks for administrator rights once.

When it finishes, the browser opens on the screen that creates the first user. To use equori in a window of its own, open it in Edge or Chrome and choose "Install this site as an app". The Start menu entry `equori` opens it later.

- Data, backups, `secret.key`, `equori.env` and the log (`log\equori.log`) live in `%ProgramData%\equori`.
- Another port: set `EQUORI_HTTP_ADDR=127.0.0.1:<port>` in `%ProgramData%\equori\equori.env`, then restart the service (`Restart-Service equori` in an administrator terminal).
- Before `equori restore`, stop the service: `equori service stop` in an administrator terminal.
- Uninstalling from Settings > Apps asks whether to delete `%ProgramData%\equori`; the answer No keeps it for a later installation.

### Homebrew (macOS, Linux)

```sh
brew install andrelopes-code/equori/equori
brew services start equori
```

Then open the setup URL that the first start writes to `setup.url` in the data directory (`~/Library/Application Support/equori` on macOS, `~/.local/share/equori` on Linux) and to the log.

Phone access over HTTPS: [docs/operations/remote-access.md](docs/operations/remote-access.md).

### One container

The standalone image holds the application and PostgreSQL; the data lives in the `/data` volume:

```sh
docker run -d --name equori -p 8080:8080 -v equori:/data ghcr.io/andrelopes-code/equori:<version>-standalone
docker logs equori 2>&1 | grep 'first user setup'
```

The line holds the URL of the screen that creates the first user (`/setup#token=...`); `docker exec equori cat /data/setup.url` prints it too.

The app listens on `http://localhost:8080`. `GET /healthz` returns `200` when the database is reachable.

API groups under `/api/v1` (contract: [api/openapi.yaml](api/openapi.yaml)): session and current user; settings; institutions, payees and tags; accounts and categories with balances; transactions with corrections, voids and version history; credit cards (billing cycle rules, credit limits, cards, statements, installment purchases, statement payments and financing, refunds, cancellations, anticipations, disputes, commitments); reconciliation (balance assertions with automatic yield, difference resolution, statement reconciliation, unlock); transaction attachments; file import (CSV profiles, OFX and CSV imports, import batches, review of external records); classification (categorization rules and their order, payee aliases, rule suggestions, running rules on uncategorized transactions, categorization method per transaction and statistics, `POST /transactions/{id}/categorize`); transfers (`POST /transactions/{id}/transfer`, which pairs the imported sides of one transfer, and the rule actions `transfer` and `mark_reimbursable`); the Brazilian banking calendar (`/calendars/br_banking/holidays`); daily balance series (`/reports/balances`). Derived series can be recomputed with `docker compose exec app /equori reporting rebuild`. Schedules created before P7 amendment A127 get their earlier occurrences with `docker compose exec app /equori planning backfill`.

API conventions ([ADR 007](docs/adr/007-api-conventions.md)): every request is validated against `api/openapi.yaml`, and a request outside the contract returns 400 `invalid_request` listing each invalid field; domain rule failures return 422. Errors are RFC 9457 problems with a stable `code` ([ADR 004](docs/adr/004-api-errors.md)). Amounts are `{"amount": <minor units>, "currency": "BRL"}`. Lists that grow take `limit` and `cursor` and return `next_cursor`. Creating a record returns 201 with `Location`; a state change (`void`, `close`, `unlock`, `resolve`, `reconcile`) returns 200 with the updated resource.

Create the first user: while no user exists, every start logs a line `first user setup` whose URL opens the screen that creates it, an admin, with a one-time token (`docker compose logs app | grep 'first user setup'`). The command line does the same (the password is prompted without echo):

```sh
docker compose exec app /equori user create --email you@example.com --language <code> --region <country> --admin
```

| Variable | Default | Description |
|---|---|---|
| `EQUORI_DATABASE_URL` | set by `compose.yaml` | PostgreSQL connection URL; unset, equori runs its own PostgreSQL server over `EQUORI_DATA_DIR` (managed mode) |
| `EQUORI_DATA_DIR` | per-user data directory; `%ProgramData%\equori` on Windows | Data directory of managed mode |
| `EQUORI_POSTGRES_BIN` | `postgresql/bin` beside the executable, else the directory of `postgres` on `PATH` | Directory of the PostgreSQL 18 programs for managed mode, `equori backup` and `equori restore` |
| `EQUORI_BACKUP_DIR` | `<data directory>/backups` | Directory of the automatic backups of managed mode |
| `EQUORI_HTTP_ADDR` | `:8080` | HTTP listen address |
| `EQUORI_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `EQUORI_TIMEZONE` | the host's zone (UTC in the container image) | IANA time zone for "today" and month boundaries, e.g. `America/Sao_Paulo` |
| `EQUORI_INSECURE_COOKIES` | `false` | `true` drops the `Secure` cookie attribute; required to log in over plain HTTP from another host |
| `EQUORI_API_DOCS` | `false` | `true` serves the API reference at `/docs` and the contract at `/openapi.yaml`, both without a session |
| `EQUORI_SECRET_KEY` | unset | 32 bytes in standard base64 (`openssl rand -base64 32`) that seal integration credentials (ADR 008); without it integrations are unavailable, except in managed mode, which generates `secret.key` in the data directory (`equori secrets key` prints it). Keep it outside backups |
| `EQUORI_SECRET_KEY_PREVIOUS` | unset | The replaced key during a rotation: `equori secrets rotate` reseals every credential, then remove it |
| `EQUORI_AGGREGATOR_PLUGGY_URL` | `https://api.pluggy.ai` | Base URL of the Pluggy API |
| `EQUORI_SYNC_INTERVAL` | `1h` | How often connections are checked for new Pluggy data (at least `1m`) |
| `POSTGRES_PASSWORD` | `equori` | Database password used by `compose.yaml` |

Data lives in the `pgdata` Docker volume. Back it up with:

```sh
docker compose exec db pg_dump -U equori equori > equori.sql
```

Commands: `serve` (the default), `user create`, `backup`, `restore`, `secrets key`, `secrets rotate`, `reporting rebuild`, `portfolio rebuild`, `planning backfill`, `service install|stop|uninstall` (Windows), `healthcheck`, `version`.

Backup and restore: [docs/operations/backup.md](docs/operations/backup.md). Export, import and archive compatibility between versions: [docs/operations/export.md](docs/operations/export.md). Bank sync through Pluggy and Meu Pluggy: [docs/operations/pluggy.md](docs/operations/pluggy.md).

The Postgres major version is pinned to 18. To upgrade the major version, dump the database, recreate the volume with the new image and restore the dump.

## Development

Requirements: Go 1.27, Node.js 24 with Corepack enabled (`corepack enable`), Docker, make.

```sh
make hooks    # pre-commit runs make check
make db-up    # local Postgres on 127.0.0.1:54329 (EQUORI_DEV_DB_PORT)
make dev      # run the app; API reference at http://localhost:8080/docs
make web-dev  # Vite dev server for the web interface, proxying /api to make dev
make gen      # regenerate sqlc and oapi-codegen output
make check    # format, tidy and codegen checks, lint, web checks, test (starts Postgres)
```

`dev.env` holds the development environment that `make dev` uses. Loaded into a shell, it lets any subcommand run against the local database:

```sh
set -a; . ./dev.env; set +a
go run ./cmd/equori user create --email you@example.com --admin
```

### Demo account

`make demo` (with `make dev` running) creates the user `demo@equori.local` and fills it with 24 months of data of a Brazilian persona: accounts and cards of four institutions, about 2300 transactions, installment plans, a brokerage portfolio with prices and income, schedules, budgets, goals, rules, imported statements and reconciliation differences. The password is `$EQUORI_DEMO_PASSWORD`, `equori-demo-account` by default. `make demo-reset` deletes the user and every row it owns. The persona and the plan are in `docs/superpowers/plans/2026-10-24-demo-account.md`.

The instruments and prices of the demo are shared by every user of the instance.

## License

MIT
