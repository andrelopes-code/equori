# Protected data (amendments A154 to A159)

Phase P13 of `docs/domain/09-roadmap.md`, section 9.4.2. Amends B3 and B5 of ADR 022 and N17 of `docs/domain/08-non-functional-requirements.md`. Scenarios S214 to S221.

## Goal

Exit criterion of P13, quoted: "An encrypted copy restored into an empty instance reproduces every fact and derived value; a test proves the diagnostic file holds no amount, name or description."

Scope of P13: daily backup in every form; encrypted copy to a chosen folder; backup screen; backup before every migration; diagnostic file; consented new-version notice.

## Current state

Read on 2026-10-31 at `b06da0be`.

| Topic | State | Source |
|---|---|---|
| Forms of 1.0 | Compose and the standalone image (section 9.4.1, Forms). Windows runs either through Docker Desktop. | Roadmap |
| Standalone image | Managed mode (ADR 022, M1): `serve` writes a pre-migration backup before pending migrations and a periodic backup every 24 hours into `/data/backups` (B3). | `cmd/equori/database.go` `migrateManaged`; `cmd/equori/backup.go` `runPeriodicBackups` |
| Compose | External mode. The `app` service runs the distroless image, which holds no `pg_dump` (B5). No automatic backup; no backup before a migration. | `compose.yaml`, `Dockerfile` |
| Backup files | `internal/platform/backup`: `Dump`, `Restore`, `Name`, `Prune`, `Newest`, `Due`; prefixes `Periodic`, `PreMigration`, `Manual`. | `internal/platform/backup/` |
| Copy outside the data disk | None. `docs/operations/backup.md` tells the owner to copy `backups/` by hand (B6). | ADR 022 |
| Instance role | `admin` and `member` on the member (ADR 029). Instance settings answer 403 `admin_required` to a member (`setSyncSchedule`, market data feeds). | `internal/identity/identity.go` `IsAdmin` |
| Outbound requests | N17: only configured integrations and price feeds. | `docs/domain/08-non-functional-requirements.md` |
| Diagnostic file, version notice | None. | — |
| First access | `POST /setup` creates the first member, an admin (`web/src/features/session/setup-page.tsx`). | `api/openapi.yaml` |

## Module

A new module `instance` (ADR 002 layout) owns the backup screen, the encrypted copy, the diagnostic file and the version notice. Its tables carry the prefix `instance_` and no `books_id`, because each holds one row for the whole instance, as `ingestion_instance_settings` does. Reason: the four concerns belong to the instance, not to a book, and `internal/platform` holds no HTTP adapter.

Every operation of the module is admin only: `x-book-role: read`, then 403 `admin_required` for a member, as `setSyncSchedule`. No operation is exposed as a language model tool; `internal/server/tool_exposure_test.go` lists each one as not exposed.

## A154 Backups in every form

1. The `app` service of `compose.yaml` runs the standalone image (`--target standalone`) in external mode. The image holds `pg_dump` and `pg_restore` of PostgreSQL 18, the major of the `db` service. Reason: one image gives both forms the same backup code; a second image with `pg_dump` adds a release job.
2. B3 applies in external mode when `EQUORI_BACKUP_DIR` is set. Managed mode keeps its default directory. External mode without the variable writes no automatic backup, so `make dev` stays as today.
3. `compose.yaml` sets `EQUORI_BACKUP_DIR=/backups`, `EQUORI_POSTGRES_BIN=/usr/lib/postgresql/18/bin` and a named volume `backups` on `/backups`.
4. When the pre-migration backup fails, `serve` exits before it migrates, in both modes. The message names the error and the directory.
5. Retention stays B3: the last 7 periodic and the last 3 pre-migration backups.

B5 is replaced: compose backs up through `serve` and `equori backup`, run as `docker compose exec app equori backup`. The distroless image stays published; no form of 1.0 uses it.

## A155 Encrypted copy

1. The copy folder is the container path in `EQUORI_COPY_DIR`, a bind mount of a host folder the owner chooses. It is an environment value because the host path is fixed when the container is created (section 9.4.1, Settings). `compose.yaml` mounts `${EQUORI_COPY_FOLDER:-./copies}` on `/copies` and sets `EQUORI_COPY_DIR=/copies`.
2. The copy password is a password the admin sets on the backup screen, at least 12 characters, separate from the login password. Reason: the server stores the login password only as a hash, and the daily copy needs a password it can read back. Storing the login password in readable form would expose it on every service where the owner reuses it.
3. The server stores the copy password encrypted with the instance secret key (ADR 008), under the same rules and the same failure as integration credentials. A copy password that does not decrypt, after a restore with another secret key, reads as unset.
4. After each successful periodic backup, when the folder and the password are set, the server writes `<backup file name>.age` to the copy folder: the dump encrypted in the age format (age-encryption.org/v1) with the scrypt recipient of the copy password. The file is written as `<name>.partial`, then renamed. Its mode is 0644: the content is encrypted, and the host program that syncs the folder runs as another user than the container.
5. The copy folder keeps the 7 newest `.age` files of the periodic prefix; older ones are removed.
6. The age format is a new dependency, `filippo.io/age`, recorded in ADR 031. Reason: a copy opens with the `age` tool without equori, and the project writes no encryption format of its own.
7. Copy states, stored after each attempt: `folder_unset`, `password_unset`, `ok`, `folder_not_writable`, `failed`. `ok` holds the instant and file name of the newest copy. A copy is late when its state is `ok` and the newest copy is older than 48 hours, or when the state is `folder_not_writable` or `failed`. Reason for 48 hours: one missed daily copy.

## A156 Restore of an encrypted copy

`equori restore FILE` accepts a file that starts with the age header. It reads the copy password from standard input, as `equori user create` reads a password, decrypts into a temporary file of mode 0600 and runs B2 on it. The temporary file is removed on every exit path. A wrong password ends with exit status 1 and the message "the copy password does not open this file"; the database is untouched.

In compose: `docker compose stop app`, then `docker compose run --rm -T app restore /copies/<file>`.

## A157 Backup screen

A settings topic `backup` in the group `system`, shown to admins only. It shows:

- Backups: the instant of the newest periodic and of the newest pre-migration backup; a warning when the newest periodic backup is older than 48 hours; the state `off` with the variable `EQUORI_BACKUP_DIR` named when automatic backups are off.
- Copy: the state of A155, the instant and file name of the newest copy, and a warning when the copy is late.
- An action that sets or changes the copy password, entered twice. The text states that copies already written keep the password they were written with.
- An action "Back up now": a periodic backup, then the copy, in the request; the answer is the new state.

Instants are shown in the member's locale and the book's time zone.

## A158 Diagnostic file

`GET /instance/diagnostic` returns `equori-diagnostic-<YYYY-MM-DD>.json` as an attachment. The file holds only these fields:

- `generated_at`; application version; schema version of the database and of the binary; Go version; operating system and architecture; mode (`managed` or `external`); PostgreSQL server version; database locale provider and locale (B7).
- `environment`: the names of the `EQUORI_*` variables set, never their values.
- `tables`: each table name with its estimated row count (`pg_stat_user_tables.n_live_tup`).
- `backup`: the fields of the backup screen, without file names.
- `connections`: per connection, the equori id, aggregator id, state, last update and last error code; no institution name, item id or account number (A44).
- `outbox`: per event type, the counts of pending and failed events.
- `log`: the last 200 records at level warn or error, held in memory since start: time, level, message, and the attributes whose key is in a fixed allowlist (`code`, `status`, `method`, `route`, `connection_id`, `duration`). The `error` attribute is left out. Reason: PostgreSQL and wrapped errors carry row values.

A log message built from data, rather than a fixed text, breaks the guarantee; S219 fails when a seeded string reaches a message. A button on the `about` topic (A159) downloads the file.

## A159 New-version notice

1. The instance stores `update_check`: null before the admin answers, then true or false. `POST /setup` takes a required `update_check` boolean, asked on the setup page with no preselected answer. An instance set up before P13 keeps null until an admin answers on the `about` topic.
2. With `update_check` true and a binary version that parses as `vMAJOR.MINOR.PATCH` with an optional pre-release suffix (ADR 022, V1), `serve` sends `GET https://api.github.com/repos/andrelopes-code/equori/releases/latest` at start and every 24 hours. The request carries the headers `User-Agent: equori` and `Accept: application/vnd.github+json`, and nothing else that identifies the instance or its version. A binary without such a version (`dev`) sends no request.
3. The answer's `tag_name` and `html_url` are kept in memory with the instant of the check. A failed check is logged at level warn and keeps the previous answer.
4. A release is newer when its MAJOR.MINOR.PATCH is greater, compared field by field as integers, or equal while the binary carries a pre-release suffix.
5. The settings topic `about`, in the group `system`, admins only, shows the version, the consent choice, the newest release with a link to its notes when it is newer, and the diagnostic file button.
6. The overview shows admins one notice line for a newer release, with the link. Dismissing it hides that version in the browser (local storage); a later version shows again.

N17 becomes: "No telemetry. The application contacts only configured integrations, price feeds and, with an admin's consent, the latest-release endpoint of the GitHub repository (P13 A159)."

## Regions

None of the values of this spec depends on region. Dates follow `Intl` (N21).

## Contract

Operations, tag `instance`:

| Operation | Method and path | Answer |
|---|---|---|
| `getBackup` | `GET /instance/backup` | 200 `BackupStatus` |
| `runBackup` | `POST /instance/backup` | 200 `BackupStatus`; 409 `backup_off` without a backup directory; 500 `backup_failed` |
| `setCopyPassword` | `PUT /instance/backup/copy-password` | 204; 400 `password_invalid` below 12 characters |
| `getDiagnostic` | `GET /instance/diagnostic` | 200 `application/json` attachment |
| `getVersion` | `GET /instance/version` | 200 `VersionStatus` |
| `setUpdateCheck` | `PUT /instance/version/update-check` | 200 `VersionStatus` |

Each answers 403 `admin_required` to a member. `postSetup` gains the required `update_check`.

`BackupStatus`: `backups` {`state` (`on`, `off`), `periodic_at`, `pre_migration_at`, `late`}, `copy` {`state` (A155), `copied_at`, `file`, `late`}. `VersionStatus`: `version`, `update_check` (boolean or null), `latest` {`version`, `url`, `checked_at`} or null, `newer` (boolean).

Migration: table `instance_settings` (one row, `id boolean PRIMARY KEY DEFAULT true CHECK (id)`): `update_check boolean NULL`, `copy_password bytea NULL`, `copy_state text NOT NULL DEFAULT 'password_unset'`, `copy_attempt_at timestamptz NULL`, `copy_at timestamptz NULL`, `copy_file text NULL`.

Documents: ADR 031 (age copy format); ADR 022 B3 and B5 amended; N17 amended and N29 added ("The diagnostic file holds no amount, name or description"; verified by S219); `docs/operations/backup.md` rewritten for compose, the copy and the restore of a copy.

## Scenarios

| ID | Scenario | Expected |
|---|---|---|
| S214 | External mode with `EQUORI_BACKUP_DIR` and a pending migration | A pre-migration file exists before the migration; with `pg_dump` absent, `serve` exits before migrating and the schema version is unchanged |
| S215 | Periodic backup with copy folder and password | `<name>.age` in the folder; decrypted with the password, its bytes equal the dump's; the 8th copy removes the oldest |
| S216 | Exit criterion: an encrypted copy restored into an empty database | Every table's rows are equal to the source's, and the balance of every account and the net worth read through the HTTP API are equal to the source's |
| S217 | Copy folder not writable | State `folder_not_writable`, `late` true; the periodic backup stays in the backup directory |
| S218 | A member calls each operation of the module | 403 `admin_required` |
| S219 | Exit criterion: diagnostic file of a book with seeded names, descriptions and amounts, after a warn log whose `error` holds a description | The file holds none of the seeded strings, nor any amount in plain or minor-unit form |
| S220 | Version check | `update_check` null or false: no request reaches the stub server; true with binary `v1.0.0` and latest `v1.0.1`: `newer` true; binary `dev`: no request |
| S221 | "Back up now" with copy configured | A new periodic file and a new copy; `copied_at` updated |
| — | `equori restore` of a copy with a wrong password | Exit status 1, the message of A156, database unchanged |

S214, S215, S216 and the restore case run under the build tag `cluster` (`make test-cluster`), which has the PostgreSQL programs.

## Out of scope

- A copy of the instance secret key inside the encrypted copy; K2 of ADR 008 holds.
- An overview notice for a late copy; P15 owns in-app notices.
- Removal of the distroless image from the release.
- Cloud storage APIs; the copy folder is a local mount.
- A diagnostic command for an instance that does not start; P14 start-up validation covers that case.

## Left to the plan

- The reading of the copy password from standard input, matching `equori user create`.
- The capture of log records in memory (a `slog.Handler` wrapper in the composition root).
- The ownership of the copy folder on Linux hosts, where the container user (`postgres`, uid 999) differs from the host user: the plan names the documented command; the P14 script applies it.

## Owner task

None. Every scenario runs in the test suites.
