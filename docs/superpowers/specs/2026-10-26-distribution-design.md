# Distribution and release

Status: draft, 2026-10-26.

## Intent

equori reaches a person today in one form: two containers, the application and PostgreSQL (`compose.yaml`). This design fixes the forms in which equori is distributed, the release that produces every form from one tag, and the version rules that carry data across upgrades and across forms.

The owner uses the same books from a computer and from a phone. The project is pre-beta. This design defines the forms and the release process now; the first public tag is the owner's decision and is not part of this design.

## Decided by the owner

| ID | Decision |
|---|---|
| O1 | The same books are used from a computer and from a phone. |
| O2 | The forms keep PostgreSQL: a server of the owner's (home server, NAS, VPS) and a computer of the owner's both run the same engine. |
| O3 | Away from the server, the phone records captures that the server processes later. Reading the books without the server is not required. |

Every other decision below is a design call and is marked as such by its absence from this table.

## Context

Measured on 2026-10-26 at commit `79ea8c8`.

### Coupling to PostgreSQL

| Item | Count |
|---|---|
| Triggers in PL/pgSQL enforcing ledger invariants (transaction balance, reconciled postings, open account, account cycle) | 7 |
| Exclusion constraints (`btree_gist`) | 1 |
| Lines in `db/queries` with ranges (`daterange`, `tstzrange`, `&&`) | 36 |
| `sqlc.slice` and `sqlc.narg` parameters | 97 |
| `jsonb` lines in queries and migrations | 21 |
| `uuidv7()` calls in migrations (PostgreSQL 18 function) | 28 |
| `LISTEN`/`NOTIFY` in the outbox dispatcher (ADR 006) | 1 |
| Lines of SQL in `db/queries` / `db/migrations` | 2,080 / 1,848 |
| Non-generated Go files importing `pgx` | 56 |

`uuidv7()` sets the minimum PostgreSQL major at 18.

Eleven queries order by a text column (`ORDER BY name`, `ORDER BY lower(name)`). Their order depends on the database collation. `compose.yaml` runs `postgres:18-alpine`. musl, the C library of that image, compares strings by code point.

### Current packaging and configuration

- `Dockerfile`: web build, then `CGO_ENABLED=0` Go build, then `gcr.io/distroless/static-debian13:nonroot`. The binary embeds the web interface (ADR 008).
- `.github/workflows/release.yml`: on a `v*.*.*` tag, images for linux/amd64 and linux/arm64 on GHCR, tags `X.Y.Z` and `X.Y`, `latest` only for a tag without `-`, and a GitHub release marked pre-release for a tag with `-`. The repository holds no tag.
- Configuration is environment only (`internal/platform/config`). `EQUORI_DATABASE_URL` is required. `EQUORI_HTTP_ADDR` defaults to `:8080`. An empty `EQUORI_TIMEZONE` resolves to UTC.
- The first admin is created by `equori user create --admin` (ADR 003). No HTTP setup endpoint exists.
- Backup is `pg_dump` run inside the `db` container (`docs/operations/backup.md`), verified by `internal/server/backup_test.go` (N12).
- The export archive is per user, and imports only into an instance of the same `schema_version` (export design E4).
- `web/public/manifest.json` exists. No service worker exists.
- Capture dates resolve against the server's today (text capture design, A109): no date phrase means today, `ontem` means today minus one day.

### PostgreSQL binary sources

| Source | Targets | Latest 18.x | Contents | Measurement |
|---|---|---|---|---|
| zonky `embedded-postgres-binaries` | linux amd64/arm64, darwin amd64/arm64, windows amd64 | 18.6.0 | `initdb`, `pg_ctl`, `postgres`; `btree_gist` and `plpgsql` present; no `pg_dump`, `pg_restore`, `pg_upgrade`; links OpenSSL 1.1 | 15 MB compressed, 60 MB extracted (linux amd64) |
| theseus-rs `postgresql-binaries` | 26 targets including linux, darwin, windows | 18.1.1 | every client and server program; `btree_gist` present | 40 MB `.tar.gz`, 25 MB `.tar.xz` pruned to 7 programs (linux amd64) |
| Package managers: official `postgres:18` image, Homebrew `postgresql@18`, PGDG apt and yum repositories | per manager | current minor | complete | not measured |

PostgreSQL 18.6, released on 2026-08-13, fixed 28 security vulnerabilities. A bundle built from theseus-rs 18.1.1 would ship without those fixes.

### Platform facts

- Homebrew deprecated casks without code signing and notarization, with removal from the official tap by September 2026. Formulas are outside that policy.
- macOS 15 removed the Control-click bypass for unsigned applications.
- iOS has no Background Sync for web applications. Safari deletes the storage of a site that is not installed on the home screen after 7 days without use. This figure comes from secondary sources and is verified in F4.
- A service worker, installation of a web application and a cookie with `Secure` each require a secure context: HTTPS, or a loopback address.

## Goals

| ID | Goal |
|---|---|
| G1 | One engine, PostgreSQL 18 or later, in every form. |
| G2 | One executable in every form. A form differs from another form only in packaging and defaults. |
| G3 | One backup file moves the data of an instance between forms and from an older release to a newer one. Integration credentials move only together with the secret key (ADR 008, K2). |
| G4 | The phone uses the installed web application. Without the server, it records captures in a queue. |
| G5 | One tag produces every artifact, with checksums and build provenance. |
| G6 | Every release migrates a database written by any earlier tagged release. |

## Non-goals

| Non-goal | Reference |
|---|---|
| SQLite or any second database engine | A1 |
| Copies of the books on several devices with synchronization | A2 |
| Native phone applications | vision 1.10 |
| A hosted service | vision 1.10 |
| Automatic updates or update checks | N17 |
| Reading the books on the phone without the server | O3, A5 |
| Windows form, desktop window wrapper, bundled PostgreSQL | deferred, see Revisit criteria |

## Anti-goals

The design fails, even when every artifact builds, when any of these holds:

- An artifact contacts a host that the owner did not configure: a download of PostgreSQL binaries at run time, an update check (N17).
- The backup of one form does not restore into another form.
- A release leaves a database at a schema version that no later release migrates.
- A release ships PostgreSQL binaries older than the current minor of their major.
- An offline capture is lost without an explicit discard by the owner.

## Analysis

### A1 Engine

SQLite would replace one process with one file. The cost is the whole persistence layer:
- the 7 triggers and the exclusion constraint move from the database into Go, so the database stops enforcing the invariants that direct SQL could violate;
- range types, arrays and `jsonb` operators become dialect-specific queries;
- migrations that add constraints need the 12-step table rebuild that ADR 001 rejected.

Two engines side by side double every query and every adapter test, on every change, without end.

PGlite in Go (gopglite, wasipg) is alpha or pre-alpha, and `btree_gist` support is unconfirmed.

Decision: PostgreSQL in every form.

### A2 Where the data lives

O1 requires the same books on two devices. Two placements satisfy it:

1. One server holds the books; computer and phone are clients.
2. Each device holds a copy, and the copies synchronize.

Placement 2 requires conflict resolution for a double-entry ledger whose invariants span rows (balance per transaction, reconciliation locks, statement closing). Two devices that each record a posting into a reconciled period produce a conflict that no field-level merge resolves.

Decision: placement 1. The phone reaches a server. The offline capture queue (A5) covers the phone without the server, because it appends text that the server validates as a new input and holds no copy of the books.

### A3 Forms

| Form | Audience | Added cost | Decision |
|---|---|---|---|
| Compose (application and PostgreSQL) | Docker hosts, VPS | none, exists | kept |
| Standalone image (one container holding both) | single-container platforms (Unraid templates, `docker run` trial) | one Dockerfile stage; managed PostgreSQL (D2) | adopted |
| Homebrew formula (macOS, Linux) | a computer without Docker | one formula; managed PostgreSQL (D2) | adopted |
| Binary archive (linux, darwin) | manual install with an external or managed PostgreSQL | build matrix (D6) | adopted |
| Installed web application on the phone | phone | service worker, capture queue (D7) | adopted |
| Installed web application on the computer | computer | none beyond D7 | adopted; Chrome, Edge and Safari offer installation from a secure context and open the application in its own window |
| Windows archive or installer | Windows without Docker | a PostgreSQL source for Windows, process handling without Unix sockets, a Windows CI runner, code signing against SmartScreen | deferred |
| Desktop window wrapper (Tauri, Wails) | users who avoid a terminal | Rust toolchain (Tauri) or a beta framework (Wails v3); WebKitGTK and the system WebView fall outside the browsers of N25; signing and notarization | deferred; the installed web application gives the window |
| Native phone application | phone | non-goal | rejected |

### A4 Source of the PostgreSQL binaries

A bundle makes equori responsible for every PostgreSQL security release. Of the measured bundle sources, the current one lacks `pg_dump` and `pg_upgrade` (zonky), and the complete one is five minor releases behind (theseus-rs). Package managers deliver the current minor with every program.

Decision: every form takes PostgreSQL from a package manager. The standalone image derives from the official `postgres:18` image. The Homebrew formula depends on `postgresql@18`. The binary archive uses the PostgreSQL installed on the host, or an external database. equori ships no PostgreSQL binary.

### A5 Phone without the server

The capture queue holds only the text the owner typed, and the server applies the normal capture rules when it receives the text. Nothing in the queue conflicts with the books.

A cache of API responses for reading offline was considered and rejected for this design:
- it shows balances computed before changes made on another device, with no server to correct them;
- it stores financial records in browser storage on a device that may be shared or lost, which raises logout and purge rules and encryption at rest;
- on iOS, the storage of a site that is not installed is deleted after 7 days without use.

### A6 Remote access

The phone needs HTTPS for the service worker, for installation and for the `Secure` session cookie. Over plain HTTP on a LAN, the application works in the browser with `EQUORI_INSECURE_COOKIES=true`, without installation and without the offline queue.

`tailscale serve` publishes a loopback port to the owner's tailnet over HTTPS. equori then stays bound to `127.0.0.1` and needs no certificate handling of its own. Embedding Tailscale in the binary (`tsnet`) adds a dependency and keeps the node identity inside the application; a guide reaches the same result without code.

### A7 Release tooling

The archive set is four targets of one `CGO_ENABLED=0` binary. A `make dist` target builds it with the Go toolchain. Release tools such as GoReleaser add a dependency for work that a target of about twenty lines covers.

## Decisions

### D1 Forms

| Form | Artifact | Targets | PostgreSQL | Data | Default listen address |
|---|---|---|---|---|---|
| Compose | `ghcr.io/andrelopes-code/equori:X.Y.Z` and `compose.yaml` | linux/amd64, linux/arm64 | service `db`, `postgres:18-alpine` | volume `pgdata` | `:8080` |
| Standalone image | `ghcr.io/andrelopes-code/equori:X.Y.Z-standalone` | linux/amd64, linux/arm64 | managed (D2), binaries of the base image `postgres:18` | volume `/data` | `:8080` |
| Homebrew | formula `equori` in tap `andrelopes-code/equori`, run by `brew services` | darwin/arm64, darwin/amd64, linux/amd64, linux/arm64 | managed (D2), `postgresql@18` | per-user data directory (D2, M1) | `127.0.0.1:8080` |
| Archive | `equori_X.Y.Z_<os>_<arch>.tar.gz` | same as Homebrew | managed with host binaries, or external | per-user data directory, or external | `:8080` |
| Phone and computer | installed web application served by any form | browsers of N25 | none | none, except the capture queue (D7) | none |

### D2 Managed PostgreSQL

Managed mode is the mode in which `equori` runs its own PostgreSQL server as a child process over a data directory it owns.

| ID | Rule |
|---|---|
| M1 | A set `EQUORI_DATABASE_URL` selects external mode, as today. An unset one selects managed mode in `EQUORI_DATA_DIR`. The default data directory is `$XDG_DATA_HOME/equori` (fallback `~/.local/share/equori`) on Linux and `~/Library/Application Support/equori` on macOS. |
| M2 | PostgreSQL programs come from `EQUORI_POSTGRES_BIN`, read from the process environment or from `equori.env` (C2). Without it, they come from the directory of `postgres` found on `PATH`. Every command resolves the programs the same way, so `equori user create` from a shell finds what `serve` finds. Homebrew's `postgresql@18` is keg-only and PGDG installs into `/usr/lib/postgresql/18/bin`; neither is on `PATH`, so the formula sets the variable (R5) and the archive's installation guide names it. The major reported by `postgres --version` is at least 18. When the data directory exists, the major equals its `PG_VERSION`. A mismatch stops the start with a message naming both majors. |
| M3 | Layout: `pg/` (cluster, mode 0700), `run/` (socket directory, mode 0700), `backups/`, `secret.key`, `equori.env`, `equori.lock`. |
| M4 | The first start runs `initdb -U equori --encoding=UTF8 --locale-provider=builtin --builtin-locale=C.UTF-8 --auth-local=trust`. `pg_hba.conf` holds one `local` line. The builtin provider orders by code point and depends on neither libc nor ICU, so an operating system upgrade never changes the order stored in an index. |
| M5 | The server runs with `listen_addresses = ''` and `unix_socket_directories` set to `run/`. No TCP port opens. Access control is the 0700 mode of `run/`. |
| M6 | `serve` takes an exclusive lock on `equori.lock`. When a server is already running on the cluster, `serve` stops it with a fast shutdown. `serve` then starts `postgres` as a child, waits until it accepts connections, applies the migrations and serves HTTP. On SIGINT or SIGTERM, `serve` stops HTTP, stops the child with a fast shutdown and waits for its exit. When the child exits during serving, `serve` exits with a non-zero status, and the service manager restarts it. |
| M7 | The other commands (`user`, `reporting`, `portfolio`, `planning`, `secrets`, `backup`, `restore`) connect through the socket while `serve` holds the lock. Otherwise they take the lock, start a temporary server and stop it before exit. |
| M8 | Started as root, managed mode exits with a message, because PostgreSQL refuses to run as root. |
| M9 | Managed mode runs on Linux and macOS. On Windows it exits with a message naming external mode. |
| M10 | The standalone image sets `EQUORI_DATA_DIR=/data`, `EQUORI_POSTGRES_BIN=/usr/lib/postgresql/18/bin` and `USER postgres`. Its `HEALTHCHECK` stays `equori healthcheck`. |

### D3 Configuration

| ID | Rule |
|---|---|
| C1 | An empty `EQUORI_TIMEZONE` resolves to the system zone (`time.Local`). A container without `TZ` and without zone files keeps UTC. `compose.yaml` keeps its explicit default. |
| C2 | In managed mode, `equori.env` in the data directory is read before the process environment. Format: one `KEY=VALUE` per line, `#` starts a comment line, no quoting, no expansion. A variable present in the process environment wins. The Homebrew service has no other place for settings that survives an upgrade. |
| C3 | In managed mode without `EQUORI_SECRET_KEY`, the first start writes 32 random bytes in standard base64 to `secret.key`, mode 0600, and uses them. The key stays outside every dump (ADR 008, K2). `equori secrets key` prints the key in use, so the owner can store it apart from the dumps and set `EQUORI_SECRET_KEY` on the instance that receives a restore. Without the key, a restored instance keeps every ledger fact and answers 409 `integration_unavailable` until the credentials are entered again (ADR 008, consequences). External mode is unchanged. |
| C4 | Applied only if F3 shows that Safari drops a `Secure` cookie on `http://127.0.0.1`: the session cookie omits `Secure` when the request's host is a loopback address. Every other host keeps `Secure` unless `EQUORI_INSECURE_COOKIES=true`. |

### D4 Backup and restore

| ID | Rule |
|---|---|
| B1 | `equori backup [--out FILE]` writes `pg_dump -Fc` of the database, through the socket in managed mode or `EQUORI_DATABASE_URL` in external mode. `pg_dump` comes from the programs of M2. The `pg_dump` major is at least the server major. The default file name is `equori-<YYYY-MM-DD>-s<schema version>.dump`, mode 0600. |
| B2 | `equori restore FILE` refuses to run while `serve` holds the lock. It drops the database, recreates it from `template0` with `LOCALE_PROVIDER builtin` and `BUILTIN_LOCALE 'C.UTF-8'` in every mode, and runs `pg_restore --no-owner --exit-on-error`. Text orderings therefore do not change when a dump moves to a host with another default locale. A dump whose schema version is above the binary's highest migration is refused (V4). The next `serve` applies the newer migrations. |
| B3 | Managed mode backs up into `backups/` before it applies pending migrations, and once per 24 hours while serving. Retention: the last 7 periodic and the last 3 pre-migration backups. `EQUORI_BACKUP_DIR` overrides the directory. |
| B4 | A dump restores into any form. This is the supported path from one form to another: computer to server, compose to standalone. |
| B5 | Compose keeps the `docker compose exec db pg_dump` procedure; the distroless application image holds no `pg_dump`. Its restore procedure creates the database with the locale of B2. `compose.yaml` sets `POSTGRES_INITDB_ARGS="--locale-provider=builtin --builtin-locale=C.UTF-8"`, which applies to a new volume only. |
| B7 | At start, `serve` logs a warning when the database's locale provider is not `builtin` with `C.UTF-8`, and names the restore of B2 as the conversion. |
| B6 | `docs/operations/backup.md` is rewritten around B1 to B5. It states that `backups/` sits on the same disk as the data and is copied elsewhere by the owner. |

### D5 Versioning

| ID | Rule |
|---|---|
| V1 | Tags follow SemVer: `vMAJOR.MINOR.PATCH`, pre-release suffixes `-alpha.N`, `-beta.N`, `-rc.N`. Versions stay `0.x` until the owner declares 1.0. |
| V2 | From the first tag on, every release migrates a database of every earlier tag. Migrations only move forward; applied migrations are never edited (CLAUDE.md, definition of done). |
| V3 | The schema version is the highest applied goose version. `equori version` prints the application version, the schema version of the binary and the minimum PostgreSQL major. |
| V4 | `serve` refuses a database that holds an applied migration unknown to the binary. The message names the binary's highest version, the database's version and the restore of a backup taken before the upgrade. In managed mode it also names the newest pre-migration file of B3. |
| V5 | The export archive keeps its own `format_version`. Import across schema versions stays out of scope (export design). |
| V6 | Raising the minimum PostgreSQL major is a breaking change of the forms: a MINOR in `0.x`, a MAJOR from 1.0. The release that raises it comes with its own upgrade design, covering `pg_upgrade` in managed mode and the image change of compose. |
| V7 | Image tags: `X.Y.Z`, `X.Y`, `latest`, and the same set with the suffix `-standalone` (`latest` becomes `standalone`). `latest` and `standalone` move only on a tag without `-`. `compose.yaml` and the documentation name a version, never `latest`. |
| V8 | Only the latest release receives fixes. No backports while `0.x`. |
| V9 | Release notes are generated by GitHub (`gh release create --generate-notes`). A release that changes a form, a minimum version or a default gets a paragraph at the top of its notes, written by the owner with `gh release edit`. |

### D6 Release pipeline

| ID | Rule |
|---|---|
| R1 | A `v*.*.*` tag starts the release. The workflow's first job runs `make check` on the tagged commit; today `release.yml` has no such step. Every publishing job depends on it. |
| R2 | `make dist` builds `equori_X.Y.Z_<os>_<arch>.tar.gz` for linux/amd64, linux/arm64, darwin/amd64 and darwin/arm64, each holding the binary, `LICENSE` and `README.md`, plus `SHA256SUMS`. The build uses `-trimpath`, the tag as version and the commit time as file time, so two builds of one commit produce the same archives. |
| R3 | Archives and images carry GitHub build provenance attestations (`actions/attest-build-provenance`), which `gh attestation verify` checks. |
| R4 | Before publishing, the job starts the standalone image, waits for a healthy state and compares `equori version` with the tag. It also runs the linux/amd64 archive's `equori version`. |
| R5 | The job updates the formula in the tap repository `andrelopes-code/homebrew-equori` (URL and SHA-256 per target). The formula installs the prebuilt binary behind a wrapper script that sets `EQUORI_POSTGRES_BIN` to the `postgresql@18` programs, so the service and every shell command resolve the same programs. It depends on `postgresql@18` and declares a `service` block with `EQUORI_HTTP_ADDR=127.0.0.1:8080`. While `0.x`, the formula follows every tag; from 1.0, only tags without `-`. |
| R6 | Credentials: `GITHUB_TOKEN` for GHCR and the release; one fine-grained token restricted to the tap repository. |
| R7 | Upgrade test (V2): the release job starts the image of the previous tag on an empty database and populates it through the HTTP API with the demo dataset. It then starts the new image on the same database and requires a successful migration, a healthy state, and the balance of every account and the row count of every fact table equal to the values read before. The first tag has no predecessor and skips the job. Each tag is tested against its predecessor, and goose applies the same migration files in the same order, so the chain covers every earlier tag. |

### D7 Phone: installed application and offline capture

| ID | Rule |
|---|---|
| P1 | A service worker at `/sw.js` registers only in a secure context and only in the production build. On install it caches `/` and every `/assets/` file that `/` names. A navigation goes to the network first, stores the answer under `/`, and falls back to the cached `/`. When the stored `/` changes, the cached `/assets/` files are deleted. A request under `/assets/` is answered from the cache first and stored on a miss. No `/api/` response is cached. |
| P2 | `/sw.js` returns `Cache-Control: no-cache`, like `index.html` (ADR 008, W11). |
| P3 | When the profile request of an authenticated route fails without an HTTP response, the application redirects to `/offline`. That screen holds a text field, the button that queues the text and the list of queued entries of the last user (P4a). |
| P4 | The queue lives in `localStorage` under `equori.capture.queue`. The entries are short texts, the synchronous API runs in the jsdom test environment without a new dependency, and no service worker reads them. An entry holds `id`, `user_id`, `text`, `default_account_id` (optional), `captured_on` (the device's local date) and `created_at`. Only entries of the signed-in user are listed. |
| P4a | The session cookie is `HttpOnly` and no API response is cached, so the device keeps its own record of the owner. Each successful load of the profile online stores `id` and `email` of the profile as the device's last user in `localStorage` under `equori.device.user`. Offline, a new entry belongs to the last user, and the offline screen shows that user's email. Logout clears the last user, so a signed-out device queues nothing. A device without a last user shows the offline state without the queue. |
| P5 | With the server reachable and a session open, the application counts pending entries on start, on the `online` event and when the page becomes visible. Opening the queue loads its entries into the capture screen. Each preview sends `reference_date = captured_on`. Confirming records through `createTransactionBatch`, and the entry is deleted only after a 2xx response. Discarding an entry is an explicit action. |
| P6 | `CapturePreviewInput` gains the optional date `reference_date`. Text capture A109 resolves every date phrase against it; without it, against today. A date after the instance's today plus one day returns 422 `validation_failed` with a field error on `reference_date`, the form the module already uses for `default_account_id`. |
| P7 | Logout keeps the entries; they are listed again when the same user signs in on the device. A discard action on an entry removes it. A failed write of the queue keeps the text in the field and shows an error. |
| P8 | The first queued entry calls `navigator.storage.persist()`. |
| P9 | No Background Sync, no push. iOS gives neither to a web application without restrictions; processing happens with the application open. |

### D8 Remote access guide

`docs/operations/remote-access.md` covers three setups:
- `tailscale serve` in front of `127.0.0.1:8080`, for Homebrew and for compose;
- a reverse proxy with a public certificate, for a VPS with a domain;
- plain HTTP on a LAN, with its limits (no installation, no offline queue, `EQUORI_INSECURE_COOKIES=true`).

### D9 Documents changed with this design

| Document | Change |
|---|---|
| ADR 021 (new) | Distribution forms, managed PostgreSQL, release pipeline and version rules (D1 to D6). |
| ADR 001 | Dated amendment: managed mode; minimum major 18; major upgrades remain the host's responsibility in compose and follow V6 in managed mode. |
| ADR 003 | Dated amendment for C4, only if C4 applies. |
| ADR 008, integration credentials (`008-integration-credentials.md`) | Dated amendment: the generated `secret.key` and `equori secrets key` of C3. |
| ADR 008, web interface (`008-web-interface.md`) | Dated amendment: the `/sw.js` rule of P2. |
| Text capture design | Amendment of A109 for `reference_date` (P6). |
| `docs/domain/01-vision.md` 1.9 | The constraint names the forms of D1. |
| `docs/domain/08-non-functional-requirements.md` | N24 lists the artifacts of D1. New requirements for B4 (dump of each form restores into each other form) and V4 (refusal of an unknown migration). |
| `README.md` | Installation per form. |
| `docs/operations/backup.md`, `docs/operations/remote-access.md` | B6, D8. |
| `docs/contributing/regions.md` | No change: this design introduces no regional value. The time zone of C1 comes from the host, and the date of P4 comes from the device. |

## Verification

| Rule | Test |
|---|---|
| M1 to M8 | Go tests of the managed mode against the PostgreSQL programs of the CI image: first start creates the layout and the cluster; second start reuses it; a server left running is stopped and replaced; a major mismatch stops the start; root is refused; a command started beside `serve` connects through the socket. |
| M4 | A test that `pg_database.datlocprovider` is `b` and `datlocale` is `C.UTF-8` for the managed database, and that the eleven text orderings return the same order under managed mode and under the compose database. |
| C1, C2, C3 | Config tests: empty zone resolves to `time.Local`; file values load; environment wins; key file created once with mode 0600 and reused. |
| B1, B2, B4 | `backup_test.go` extended: a managed dump restores into an external database and the reverse, with the N12 comparisons. |
| B3 | Test with `apitest.Today`-style fixed clock: a pending migration produces a pre-migration backup; retention keeps 7 and 3. |
| V3, V4 | `equori version` output test; a database with an extra row in `goose_db_version` above the binary's highest version is refused. |
| V2 | R7 on every tag after the first. |
| B2, B7 | A restored database reports provider `builtin` and locale `C.UTF-8`; `serve` on a database with provider `libc` logs the warning. |
| P4a | Web tests: a load of an authenticated route stores the last user; logout clears it; the offline screen without a last user shows no queue. |
| R2 to R4 | CI on the tag: archive checksums, attestation verification, standalone smoke test. `make dist` run twice yields identical `SHA256SUMS`. |
| P1 to P8 | Web tests of the queue: enqueue offline, list per user, process with `reference_date`, delete after 2xx only, keep on failure, keep on logout, keep the text on a failed write. A Node test of `sw.js` with fake `caches` and `fetch` covers P1. |
| P6 | API test through `internal/apitest`: `ontem` with `reference_date` 2026-10-20 resolves to 2026-10-19; `validation_failed` on `reference_date` for today plus two days, and acceptance of today plus one day. |
| C4 | Manual check in Safari on macOS against `http://127.0.0.1:8080`: login keeps the session. A failure activates C4 and its test. |

## Phases

Each phase ends releasable. The order is a design call.

| Phase | Content | Depends on |
|---|---|---|
| F1 Release foundation | V3, V4 without the managed-mode part of its message, C1, R1 to R4 and R7 without the standalone image, `compose.yaml` pinned to a version, ADR 021 | none |
| F2 Managed PostgreSQL | D2, C2, C3, D4, the managed-mode part of V4, standalone image and its smoke test, amendments of ADR 001 and of both ADR 008 files that concern it | F1 |
| F3 Homebrew | R5, the tap repository, D8, the Safari check of C4 | F2 |
| F4 Phone | D7, text capture amendment | F1 only for its release; independent of F2 and F3 |

## Settled during planning

| Item | Value |
|---|---|
| Socket path over the limit (107 bytes on Linux, 103 on macOS) | `run/` moves to `$TMPDIR/equori-<first 12 hex digits of SHA-256 of the data directory>`, mode 0700. |
| Server settings of the managed cluster | `listen_addresses=''`, `max_connections=50`, every other setting at its default; passed as `-c` flags on each start. |
| Precache list of P1 | No build step: the service worker reads `/` at install and caches the `/assets/` files it names (P1). |
| Periodic backup | A goroutine of `serve` checks every hour whether the newest periodic file is older than 24 hours. |
| Managed-mode tests | Build tag `cluster`; `make test-cluster` runs the compiled test binaries inside the `postgres:18` image, which holds the PostgreSQL programs. |

## Revisit criteria

| Deferred item | Revisit when |
|---|---|
| Bundled PostgreSQL | A source publishes binaries with `pg_dump`, `pg_restore`, `pg_upgrade` and `btree_gist` for linux, darwin and windows within 14 days of each minor release, observed over two consecutive minors. |
| Windows form | A bundled PostgreSQL source qualifies, and the owner decides on code signing. |
| Desktop window wrapper | The Windows form is adopted, or installation without a terminal is requested for macOS. |
| Reading offline | The owner reports the need. Encryption at rest of browser storage is then decided first. |
| Embedded Tailscale (`tsnet`) | The remote access guide fails a reported setup. |

## Sources

- zonky binaries: https://repo1.maven.org/maven2/io/zonky/test/postgres/ (contents measured from `embedded-postgres-binaries-linux-amd64-18.6.0.jar`)
- theseus-rs binaries: https://github.com/theseus-rs/postgresql-binaries/releases (contents measured from `postgresql-18.1.1-x86_64-unknown-linux-gnu.tar.gz`)
- PostgreSQL 18.6 release, 2026-08-13: https://neon.com/docs/postgresql/postgres-version-support
- PGlite v0.4: https://electric-sql.com/blog/2026/03/25/announcing-pglite-v04; gopglite: https://pkg.go.dev/github.com/bobTheBuilder7/gopglite; wasipg: https://github.com/moznion/wasipg
- Homebrew cask signing policy: https://workbrew.com/blog/what-homebrew-5-0-0-means-for-your-mac-fleet
- Tauri sidecar: https://v2.tauri.app/develop/sidecar; Wails releases: https://github.com/wailsapp/wails/releases
- iOS web application limits: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- Tailscale Serve: https://tailscale.com/kb/1312/serve
