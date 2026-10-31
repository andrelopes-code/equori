# Installation (amendments A160 to A166)

Phase P14 of `docs/domain/09-roadmap.md`, section 9.4.2. Amends B5 and the Configuration and Delivery sections of ADR 022. Scenarios S222 to S233.

## Goal

Exit criterion of P14, quoted: "A clean machine of each system reaches first access with one pasted command, checked in the release job or by a documented owner check."

Scope of P14: a configuration map in code that generates the installation guide and the example `.env`; start-up validation that names the variable, the expected value and an example; a one-command script (Docker check, WSL2 on Windows, free port, secret key, database password); first access by region and book; guides for Linux, macOS and Windows.

A clean machine is a fresh installation of the system on which the owner has followed the prerequisites section of its guide. Reason: section 9.4.1, Audience, sets "people who follow a guide and paste one prepared terminal command"; the scope names a Docker check, not a Docker installation.

## Current state

Read on 2026-10-31 at `5dddf7b9`.

| Topic | State | Source |
|---|---|---|
| Variables read by the binary | `EQUORI_DATABASE_URL`, `EQUORI_DATA_DIR`, `EQUORI_POSTGRES_BIN`, `EQUORI_BACKUP_DIR`, `EQUORI_COPY_DIR`, `EQUORI_HTTP_ADDR`, `EQUORI_LOG_LEVEL`, `EQUORI_INSECURE_COOKIES`, `EQUORI_API_DOCS`, `EQUORI_SECRET_KEY`, `EQUORI_SECRET_KEY_PREVIOUS`, `EQUORI_WEB_DEV_PORT` in `config.Load`; the families `EQUORI_AGGREGATOR_<ID>_URL` and `EQUORI_FEED_<ID>_URL` in `cmd/equori/main.go`; `EQUORI_HTTP_ADDR` again in `healthcheck`, `EQUORI_DATA_DIR` again in `readEnvFile` and `service.go` | `internal/platform/config/config.go`, `cmd/equori/` |
| Validation | `config.Load` returns the first error only. `EQUORI_HTTP_ADDR` and the two URL families are not validated. A misspelled name is ignored without a message. | `config.go` |
| Variable reference | A hand-written table in `README.md`, section Run, which omits `EQUORI_COPY_DIR`, `EQUORI_WEB_DEV_PORT` and `EQUORI_FEED_<ID>_URL` | `README.md` |
| Compose | Publishes `8080:8080` on every interface. Passes no `EQUORI_SECRET_KEY`: bank connections, the second factor and the copy password answer `secret_key_missing` or `integration_unavailable`. `POSTGRES_PASSWORD` defaults to `equori`. | `compose.yaml`, `internal/identity/internal/adapter/httpapi/server.go` |
| Installation | `curl -fsSLO .../compose.yaml` and `POSTGRES_PASSWORD=change-me docker compose up -d`; the setup URL is read from `docker compose logs app`. No script. | `README.md` |
| Release assets | `*.tar.gz`, `compose.yaml` pinned to the release by `sed`, `SHA256SUMS`, the Windows installer when signed | `.github/workflows/release.yml` |
| Setup token | 32 random bytes in raw base64url, logged as `first user setup` with `url` `http://127.0.0.1:8080/setup#token=<token>` for `EQUORI_HTTP_ADDR` `:8080`. `setup.url` is written in managed mode only. | `internal/identity/internal/app/setup.go`, `cmd/equori/setup_url.go` |
| First access | `completeSetup` takes email, password, language, region, optional base currency and `update_check`. The book is named `DefaultBooksName(email)`; its `time_zone` is null, so the region's default applies. The region has no preselected value. | `api/openapi.yaml` `SetupInput`, `web/src/features/session/setup-form.tsx` |
| Image | The standalone image runs as `postgres` (uid 999), multi-arch `linux/amd64,linux/arm64`. | `Dockerfile`, `release.yml` |

## A160 Configuration map

1. `internal/platform/config` holds one table, `Variables`, with one entry per variable. An entry holds: name; reader (`binary` or `compose`); kind; default as text; expected value as text; one example value; secret flag; audience (`install`, `advanced`, `development`); an English and a Portuguese description. Reason: one table produces the parsing, the messages of A161, the reference of A165 and `env.example`, so the four never disagree.
2. A family entry names a pattern, `EQUORI_AGGREGATOR_<ID>_URL` and `EQUORI_FEED_<ID>_URL`, and matches every name with that prefix and suffix.
3. Kinds: `url` (absolute, scheme `postgres`, `postgresql`, `http` or `https` as the entry states), `path`, `listen_address` (`host:port`, port 1 to 65535), `port` (1 to 65535), `ip`, `bool` (`strconv.ParseBool`), `log_level` (`slog.Level.UnmarshalText`), `key32` (32 bytes in standard base64), `password`.
4. `config.Load` parses every `binary` entry from the table. `healthcheck`, `readEnvFile`, `service.go`, `aggregatorURLs` and `feedURLs` read their values through `config`. A test records each name passed to `getenv` during `Load` and the two family readers and expects each name to match an entry. Reason: a variable read outside the table escapes the reference and the validation.
5. `compose` entries are read by `compose.yaml` only: `POSTGRES_PASSWORD` (`password`, secret), `EQUORI_PORT` (`port`, default `8080`), `EQUORI_HOST_IP` (`ip`, default `127.0.0.1`), `EQUORI_COPY_FOLDER` (`path`, default `./copies`), `EQUORI_VERSION` (audience `advanced`, set by the release).
6. `make gen` writes three files from the table: `docs/install/configuration.md`, `docs/install/configuration.pt-BR.md` and `env.example`. `make gen-check` adds the three to its `git diff --exit-code`. Reason: the existing check of generated files covers them without a new tool.
7. `env.example` holds the `install` entries. Each entry has one comment line in English with the description, the expected value and the default. An entry the script generates (`POSTGRES_PASSWORD`, `EQUORI_SECRET_KEY`, `EQUORI_PORT`) is written `NAME=`; every other entry is written commented, `# NAME=<default>`. Reason: a commented line keeps the default of `compose.yaml` in force until the owner sets it. Comments are in English, as every file of the repository (`CONTRIBUTING.md`, Language); the Portuguese guide of A165 explains each line.
8. The reference of A165 groups the entries by audience. The `README.md` table is replaced by a link to it.

## A161 Start-up validation

1. Every command that calls `config.Load` validates every `binary` entry that is set and reports every invalid entry in one run, in table order, then exits with status 1. Reason: one start per correction, instead of one per invalid variable.
2. Each invalid entry is one line: `<NAME> is "<value>"; expected <expected>; example: <NAME>=<example>`. For a secret entry the line reads `<NAME> is set but invalid; expected ...`, without the value. Reason: start-up output is pasted into issues, and the database URL holds a password.
3. The block starts with the line `invalid configuration (docs/install/configuration.md):`.
4. An `EQUORI_` name set in the environment or in `equori.env` that matches no entry, no family and no removed variable (`config.RemovedVariables`) is logged at level warn as `environment variable unknown` with the attribute `variable`; the start continues. Reason: a misspelled name otherwise has no effect and no message.
5. A failed first connection to the database in external mode ends `serve` with `cannot connect to the database of EQUORI_DATABASE_URL (host <host>, port <port>, database <name>): <error>`. The password never appears.
6. A failed listen on `EQUORI_HTTP_ADDR` ends `serve` with `EQUORI_HTTP_ADDR "<value>": <error>; expected a free host:port; example: EQUORI_HTTP_ADDR=127.0.0.1:8081`.
7. External mode without `EQUORI_SECRET_KEY` logs at level warn, at each start, `EQUORI_SECRET_KEY is not set: bank connections, the second factor and the copy password are unavailable`. The start continues. Reason: an instance installed before P14 keeps starting after the upgrade.
8. Messages are in English, as every log message (`CONTRIBUTING.md`, Language). The troubleshooting section of each guide quotes each message with its correction in both languages.

## A162 Compose file

1. `ports` becomes `"${EQUORI_HOST_IP:-127.0.0.1}:${EQUORI_PORT:-8080}:8080"`. Reason: Tailscale Serve and a reverse proxy reach the loopback address (`docs/operations/remote-access.md`), and a login over plain HTTP from the network fails without `EQUORI_INSECURE_COOKIES` (ADR 003). Network access sets `EQUORI_HOST_IP=0.0.0.0` and `EQUORI_INSECURE_COOKIES=true` in `.env`; `remote-access.md` states this.
2. `app.environment` passes `EQUORI_SECRET_KEY`, `EQUORI_SECRET_KEY_PREVIOUS`, `EQUORI_LOG_LEVEL`, `EQUORI_INSECURE_COOKIES` and `EQUORI_API_DOCS` as `NAME: ${NAME:-}`. An empty value reads as unset in `config.Load`. A test of the map expects each `binary` entry of audience `install` to appear in `compose.yaml` in that form.
3. `POSTGRES_PASSWORD` keeps the default `equori`. Reason: an existing volume was initialized with that password, and PostgreSQL reads `POSTGRES_PASSWORD` on a new volume only.
4. The project name stays the directory name. Reason: a fixed `name:` would detach the volumes of an installation in a directory with another name.

## A163 Installation script

Two scripts: `scripts/install.sh` (POSIX `sh`, Linux and macOS) and `scripts/install.ps1` (Windows PowerShell 5.1). The release attaches both, pinned to its version as `compose.yaml` is. The pasted commands:

```sh
curl -fsSL https://github.com/andrelopes-code/equori/releases/latest/download/install.sh | sh
```

```powershell
irm https://github.com/andrelopes-code/equori/releases/latest/download/install.ps1 | iex
```

Steps, in order. Each stop prints one message and the link to the guide section that corrects it, exits with status 1 and leaves no file behind.

1. Language of the messages: Portuguese when `LANG` (`sh`) or `(Get-Culture).Name` (PowerShell) starts with `pt`, English otherwise. Reason: section 9.4.1, Languages; a language without texts gets English.
2. Docker check: `docker` on the path, `docker info` answers, `docker compose version` answers. Each failure is its own stop: Docker absent, Docker not answering (daemon stopped, or on Linux a user outside the `docker` group), Compose v2 absent. The script installs nothing on the system. Reason: an installation of Docker needs administrator rights, differs per distribution, and on Windows needs a restart that ends the script.
3. WSL2 on Windows: `docker info --format '{{.KernelVersion}}'` contains `WSL2`. Otherwise the stop names the Docker Desktop setting "Use the WSL 2 based engine", or `wsl --install` when `wsl.exe` is absent. Reason: section 9.4.1, Forms, sets Docker Desktop with WSL2; the kernel version is the one value that tells the WSL2 engine from the Hyper-V engine.
4. Directory: `~/equori` (`%USERPROFILE%\equori` on Windows), created when absent. A directory that holds `compose.yaml` and no `.env` is a stop. Reason: an installation made by the earlier README has a database password the script cannot know; a new password would fail on the existing volume.
5. Downloads `compose.yaml` and `env.example` of the pinned release into the directory, replacing `compose.yaml`.
6. `.env` absent: writes it from `env.example` with `POSTGRES_PASSWORD` 32 random characters of `[A-Za-z0-9]`, `EQUORI_SECRET_KEY` 32 random bytes in standard base64, and `EQUORI_PORT` from step 7. Mode 0600 on Linux and macOS; UTF-8 without byte order mark and LF line endings on Windows. `.env` present: kept byte for byte. Reason: a new secret key loses the stored credentials (ADR 008, K2), and a new password fails on the existing volume.
7. Free port, only when `.env` is absent: the first of 8080 to 8099 with no listener on the host. None free is a stop. Reason: the audience answers no question.
8. Creates `copies` in the directory. On Linux it runs `docker compose run --rm --no-deps --user 0 --entrypoint chown app 999:999 /copies`. Reason: the container user (uid 999) writes the copies (P13, "Left to the plan"); Docker Desktop maps ownership on macOS and Windows.
9. `docker compose pull`, then `docker compose up -d`. A re-run on an existing installation is the upgrade; `serve` backs up before it migrates (B3).
10. Waits up to 180 seconds for `GET http://127.0.0.1:<EQUORI_PORT>/healthz` to answer 200. A timeout is a stop that also prints the last 20 lines of `docker compose logs app`, which hold the messages of A161.
11. First access: the last `first user setup` line of `docker compose logs app` gives the token, matched by `#token=([A-Za-z0-9_-]+)`. The script prints `http://127.0.0.1:<EQUORI_PORT>/setup#token=<token>` and opens it with `open` (macOS), `xdg-open` (Linux, when present) or `Start-Process` (Windows). Without such a line, a member exists, and the script prints and opens `http://127.0.0.1:<EQUORI_PORT>/`. Reason: the logged URL names the container port, which differs from the host port of step 7.
12. Final lines: the directory, the address, and the instruction to keep a copy of `.env` apart from the backups, because it holds the secret key (ADR 008, K2).

`EQUORI_INSTALL_SOURCE`, when set, names a local directory read in place of the downloads of step 5. The release job of A166 sets it; the guides do not name it.

## A164 First access by region and book

1. `SetupInput` gains `books_name` (optional, 1 to 80 characters after trim) and `time_zone` (optional, IANA name). Each follows the validation of `updateCurrentBooks`; an invalid `time_zone` answers 422 `time_zone_invalid`. Without `books_name`, the book keeps `DefaultBooksName(email)`.
2. The server stores `time_zone` null when it is absent or equal to `DefaultTimeZone(region)`. Reason: null keeps the book on the region's default, as the setting screen does (BK18).
3. The setup form preselects the region from the region subtag of the browser language (`navigator.language`) when that subtag is an assigned region code; otherwise the region stays unselected, as today. Reason: a browser in `pt-BR` completes the region with no choice.
4. The setup form adds the book name, empty, with a catalog placeholder, and the time zone, prefilled with the browser's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and chosen with the control of the time zone setting. Reason: Brazil spans four zones, and the region default of `BR` covers one.

## A165 Guides

1. `docs/install/linux.md`, `docs/install/macos.md`, `docs/install/windows.md`, each with a Portuguese twin `<system>.pt-BR.md`. Sections: prerequisites (Docker Engine with the Compose plugin and the `docker` group on Linux; Docker Desktop on macOS; `wsl --install`, a restart and Docker Desktop with the WSL 2 engine on Windows), the command of A163, first access, upgrade (the same command), start and stop, removal (`docker compose down` keeps the data; `docker compose down -v` deletes it), troubleshooting. Each stop of A163 and each message of A161 has a troubleshooting entry, and the script's links point at these entries.
2. Prerequisites link to the Docker documentation for the installation of Docker. Reason: the steps change with Docker releases, and a copy in the guide goes stale.
3. `README.md`, section Run, holds the two commands and links to the three guides. The paragraphs on the Windows installer and on Homebrew move under a heading "Outside the supported set of 1.0". Reason: section 9.4.1, Forms.
4. `docs/operations/backup.md` and `remote-access.md` replace the port and the password of their compose commands with the values of `.env`.

## A166 Release and check

1. The release job attaches `install.sh`, `install.ps1` and `env.example`, the scripts pinned to the release tag by `sed`, as `compose.yaml` is pinned.
2. `scripts/install-smoke.sh` and `make install-smoke` run S227 to S230 on Linux against the image built by the job, tagged as the pinned `compose.yaml` names it, with `EQUORI_INSTALL_SOURCE=dist` and `HOME` set to a temporary directory. The release job runs it after `standalone-smoke`. Reason: GitHub's macOS runners have no Docker, and its Windows runners run Windows containers, so only Linux is checked in the job.
3. The Windows job parses `install.ps1` with `[System.Management.Automation.Language.Parser]::ParseFile` and fails on any parse error.
4. macOS and Windows are checked by the owner, as a step of the checklist of `docs/operations/release.md`: a fresh machine or virtual machine of each system, the prerequisites of its guide, the pasted command, the setup screen reached. The release notes name the version and the date of each check.

## Regions

The values of this spec do not depend on region. The region preselected by A164.3 comes from the browser. The script carries the texts of the two languages of 1.0 (section 9.4.1, Languages). The default book name stays `DefaultBooksName`; the time zone default stays `DefaultTimeZone(region)` of `internal/identity/region_defaults.go` (ADR 016).

## Contract

`SetupInput` gains:

```yaml
books_name:
  type: string
  minLength: 1
  maxLength: 80
time_zone:
  type: string
```

`completeSetup` gains the answer 422 `time_zone_invalid`.

Files: `internal/platform/config/variables.go` (the table of A160); `docs/install/configuration.md`, `docs/install/configuration.pt-BR.md`, `env.example` (generated); `scripts/install.sh`, `scripts/install.ps1`, `scripts/install-smoke.sh`; `docs/install/{linux,macos,windows}.md` and their `.pt-BR.md` twins.

Documents: ADR 022 gains rule C5 (the map of A160 and its generated files), C6 (A161), D9 (A163 and A166), and B5 adds the bindings of A162.1; `README.md`, `docs/operations/backup.md`, `docs/operations/remote-access.md`, `docs/operations/release.md` per A165 and A166.

## Scenarios

| ID | Scenario | Expected |
|---|---|---|
| S222 | `serve` with `EQUORI_LOG_LEVEL=verbose` and `EQUORI_SECRET_KEY=abc` | Exit status 1; standard error holds the header line of A161.3, then one line per variable in table order; the line of `EQUORI_SECRET_KEY` does not hold `abc` |
| S223 | `EQUORI_HTTP_ADDR=localhost` and `EQUORI_AGGREGATOR_PLUGGY_URL=ftp://a` | Each is reported by A161.2 with its expected value and example |
| S224 | `EQUORI_LOG_LEVL=debug` set | One warn record `environment variable unknown` with `variable` `EQUORI_LOG_LEVL`; the start continues |
| S225 | External mode, `EQUORI_DATABASE_URL` with password `s3cret` and a closed port | The message of A161.5 names host, port and database; it does not hold `s3cret` |
| S226 | `EQUORI_HTTP_ADDR` on a port that has a listener | The message of A161.6 |
| S227 | Exit criterion, Linux: the script in an empty `HOME` | Exit status 0; `.env` mode 0600; `POSTGRES_PASSWORD` of 32 characters of `[A-Za-z0-9]`; `EQUORI_SECRET_KEY` decodes to 32 bytes; the printed URL's token answers `completeSetup` with 201 on the port of `.env` |
| S228 | The script run again after S227 | `.env` equal byte for byte; the printed address has no token; `GET /healthz` 200 |
| S229 | The script with a listener on 8080 | `EQUORI_PORT=8081` in `.env`; the printed URL uses 8081 |
| S230 | The script with `docker` absent from the path | Exit status 1; the message of Docker absent with its guide link; no `.env` and no `compose.yaml` written |
| S231 | `completeSetup` with `books_name` "Casa", `time_zone` `America/Manaus`, region `BR`; then with `time_zone` `America/Sao_Paulo`; then with `time_zone` `Mars/Base` | The book is named "Casa" with `time_zone` `America/Manaus`; then `time_zone` null; then 422 `time_zone_invalid` and no member created |
| S232 | Setup page with browser language `pt-BR`; then `en` | The region `BR` is selected; then no region is selected |
| S233 | Exit criterion, macOS and Windows | The owner check of A166.4 |
| — | `make gen-check` after a change to the table without `make gen` | Fails on the generated files |

## Out of scope

- Installation of Docker or WSL by the script.
- Podman and rootless Docker.
- Conversion of an installation made by the earlier README; the guide's troubleshooting entry for A163.4 tells the owner to write `.env` with the existing password.
- A choice of installation directory.
- Removal of the Windows installer and Homebrew release jobs.
- In-app help pages; P15 owns them.
- HTTPS and remote access set-up beyond A162.1.

## Left to the plan

- The text of each script message in both languages and the guide anchor of each.
- The detection of a listener per system for A163.7.
- The Go type and field names of the table entries, and the generator's package path under `internal/platform/config`.
- The order of the existing `config.Load` checks inside the single report of A161.1.

## Owner task

The check of A166.4 on macOS and on Windows, before the tag of 1.0 (P16).
