# Test and release (amendments A178 to A186)

Phase P16 of `docs/domain/09-roadmap.md`, section 9.4.2. Scenarios S253 to S261.

## Goal

Exit criterion of P16, quoted: "Every exit criterion passes; no open defect of data loss, duplication or exposure".

Scope of P16, quoted: "Security review; the owner and close people use real accounts of several banks; fixes; check of every exit criterion of P10 to P15; tag `v1.0.0` (ADR 022, V1)".

The agents of P16 execute every item that runs on the Linux development host. An item that needs hardware, an operating system or an account absent from that host is an owner task: the spec names it, records the evidence of its absence, and the phase continues without it. The tag `v1.0.0` is an owner task (A186).

## Current state

Checked on 2026-11-01 at `a098cc0b`.

| Phase | Status | Open item |
|---|---|---|
| P10 | delivered | None |
| P11 | review | None in the exit criterion. Owner tasks of the three P11 plans: an invited person checks each role; two books on a phone and on a computer; a passkey on a phone and on a computer over HTTPS; TOTP with an authenticator app; `equori user reset-second-factor` |
| P12 | review | A143 query, due on or after 2026-11-07: migration 77 was applied to `equori-db-1` on 2026-10-31 23:54 UTC. The query returns 0 on 2026-11-01. Owner task of the grouped confirmation review plan: resolve a group with `match` after a real sync |
| P13 | review | None. The plan Review records both exit tests passing |
| P14 | review | S233: macOS and Windows owner checks (release checklist step 7). The host is Linux 6.8.0 without `/dev/kvm`, without `vmx` or `svm` CPU flags, and without `qemu-system-x86_64`, `VBoxManage`, `vagrant` or `pwsh` |
| P15 | delivered | The four S252 findings (A181 to A183; the fourth is out of scope) |

`make check` on 2026-11-01 stops at `make lint` with one finding: `internal/platform/postgres/pgtest/pgtest.go:196` (`wsl_v5`). Run one by one, `make test-race` passes (75 packages) and `make web-static` passes. `make test-cluster` fails four tests of `cmd/equori` (`TestClusterBackupDoesNotMigrate`, `TestClusterBackupDefaultsToBackupDir`, `TestClusterRestoreWrongCopyPassword`, `TestClusterRestoreCopyCommand`): `dsnOf` and `TestClusterBackupDoesNotMigrate` of `backup_cluster_test.go` set `EQUORI_DATABASE_URL` to a key-value DSN, which the start-up validation of P14 refuses ("expected a postgres:// or postgresql:// URL"). The web suite holds four failures (2330 of 2334 pass):

| Test | Cause |
|---|---|
| `src/features/accounts/accounts-page.test.tsx`, "adds up assets, liabilities and net worth in the base currency" | `findByText("R$15,390.55")` reads one text node. `MoneyValue` draws the symbol and the minor digits in unit parts, so the amount is the text of the value part. `src/testing/money-value.ts` (`moneyValue`) matches that part. |
| `src/features/cards/cards-page.test.tsx`, "adds up the open statements, what is due and the free limit" | Same cause, `R$2,500.00` and `R$1,800.00`. |
| `src/features/planning/budget-pages.test.tsx`, "shows the figures of the month the page reads" | Same cause, `R$1,800.00`. |
| `src/navigation/navigation-map.test.ts`, "lists every route except the ones the assistant never links" | `dae29e97` added the route `/settings/appearance`; `src/navigation/navigation-map.json` has no entry for it. |

## A178 Security review

The review covers the HTTP surface, authentication, authorization between books, stored secrets, file handling, dependencies and the container. Each row records the evidence read on 2026-11-01.

| Area | Evidence | Result |
|---|---|---|
| Response headers | `internal/platform/httpserver/middleware.go`, `securityHeaders`: `nosniff`, `Referrer-Policy: no-referrer`, a CSP per surface, `Cache-Control: no-store` on `/api/` | Pass |
| Cross-site requests | `http.NewCrossOriginProtection` in `Middleware`; cookies `HttpOnly`, `SameSite=Lax`, `Secure` unless `EQUORI_INSECURE_COOKIES=true` (`identity/internal/adapter/httpapi/server.go`, `cookie`, `loginCookie`) | Pass |
| Body size | `limitBody`: 1 MiB unless a `BodyLimit` names the pattern | Pass |
| Passwords | argon2id (`identity/internal/password`); an unknown email verifies a dummy hash (`service.go`, `dummyHash`); login and second-factor attempts are throttled per email (`throttle.go`, 429 `too_many_attempts`) | Pass |
| Stored tokens | Sessions, access tokens, invitations and recovery codes are stored as SHA-256 hashes (`token_hash` columns of migrations 63 and 74, `domain/session.go`, `domain/recovery_code.go`); the TOTP secret is sealed (ADR 008, K3) | Pass |
| Authorization | 247 operations in `api/openapi.yaml`, each with `x-book-role`: 6 `public`, 132 `read`, 96 `write`, 13 `owner`; `internal/server/book_role_test.go`. Instance operations check `IsAdmin` in the module (`instance/internal/app/service.go`, `marketdata/feed_settings.go`) | Pass |
| Attachments | `GetAttachmentContent`: `attachment` disposition and `default-src 'none'` by default; `inline` only for `app.Inlineable` types | Pass |
| SQL | sqlc queries; the dynamic SQL of the archive (`reporting/internal/adapter/postgres/import.go`, `archive.go`) quotes every identifier with `pgx.Identifier.Sanitize` and binds every value | Pass |
| Archive import between books | `insert` keeps every column of an archive row but `books_id`. On 2026-11-01, 77 of the 129 foreign keys are composite with `books_id`, so a row that names another book's row fails with `23503` and the import answers 500 `internal_error` without writing. One exported foreign key is single-column to a table with `books_id`: `ledger_transaction_version.transaction_id`, in a table without `books_id`. An archive version row naming a transaction of another book imports with 200 and attaches its snapshot to that transaction (plan check, 2026-11-01) | Finding SR1, A179 |
| Shared market data | Archive rows of `sharedTables` insert with `ON CONFLICT DO NOTHING`. `recordPrice`, `importPrices` and `defineInstrument` already write the same tables with the role `write` | Accepted: the archive adds no write that the role lacks |
| Language model address | A provider's `base_url` reaches any host the server reaches. The presets `ollama` and `lmstudio` (`assistant/internal/domain/preset.go`) need loopback addresses. The operations are `owner` | Accepted: a filter of private addresses removes the local presets of ADR 019 |
| Go dependencies | `make vuln`: 0 vulnerabilities in called code; `golang.org/x/crypto` v0.58.0 carries GO-2026-5932 (`openpgp`, no fix), a package equori does not import | Accepted |
| Web dependencies | `pnpm audit --prod`: `seroval` 1.6.9 through `@tanstack/router-core` 1.171.34, GHSA-f86p-h4j2-7qgj (fixed in 1.6.11) and GHSA-9wx9-5pv9-3349 (fixed in 1.6.10), both moderate. `router-core` accepts `seroval ^1.6.7` | Finding SR2, A180 |
| Container | Final image `gcr.io/distroless/static-debian13:nonroot`; the standalone image runs as `postgres`; compose publishes on `127.0.0.1` unless `EQUORI_HOST_IP` is set (P14 A162) | Pass |
| Backups | Backup files `0o600`; encrypted copies `0o644` by ADR 031; the copy folder comes from the environment (`CopyDir`) | Pass |

## A179 An archive import stays inside its book

Rule 1: before the rows of a table are inserted, the import checks every single-column foreign key of that table whose referenced table has a `books_id` column. A row whose referenced row exists with another `books_id` rejects the whole import with 409 `import_conflict`. The transaction writes nothing (export design E4).

Rule 2: a `23503` foreign key violation during the import answers 422 `archive_invalid` with field `file`, in place of 500. A composite key cannot tell a row of another book from a missing row; neither exists in the importing book, so the archive does not read as an export of that book.

Reason: the existing codes name both cases: `import_conflict` reads "an identifier of the archive belongs to another book", `archive_invalid` reads "the archive does not read as an export of this instance". No new `Problem.code` and no change of `api/openapi.yaml` follow.

The check of rule 1 reads the catalog (`pg_constraint`) as `loadOrder` does, so a table added by a later migration is covered without a list. A reference to a table without `books_id` (shared market data) is not checked. A reference to a row of the same import names no row yet and passes.

## A180 Web dependency advisories

`web/pnpm-lock.yaml` resolves `seroval` and `seroval-plugins` to the latest 1.x release inside the range of `@tanstack/router-core`, at least 1.6.11. `web/package.json` is unchanged. Reason: the advisories are fixed inside the declared range; a lockfile update is not a new dependency (`CONTRIBUTING.md`, Code).

## A181 Institution catalogue by trade name

S252 found that "Nubank" finds no entry and "Ita" lists "Banco ItauBank" first.

- The catalogue entry takes its `name` from `displayName` of `logos-bancos-br/data/bancos.json` when the entry has one; otherwise `displayName(legal)` as today. On 2026-11-01, 168 of the 492 entries with a PNG logo have one, among them "Nubank" (ISPB 18236120), "Itaú" (60701190), "Caixa" (00360305), "Inter" (00416968), "C6 Bank" (31872495), "Mercado Pago" (10573521) and "PicPay" (22896431).
- `searchEntities` returns first the entries whose label starts with the query, accents and case ignored, then the other matches; the order inside each group is the catalogue order.

Reason: `bancos.json` ships in the package already pinned (`logos-bancos-br` 0.8.2), so no new dependency follows. The catalogue is the Brazilian implementation of the `br_ispb` scheme (`docs/contributing/regions.md`, row "Institution identifier scheme"); no extension point changes.

## A182 The walkthrough row names its institution as required

A row of the walkthrough counts only with an institution (P15 A173). The `Field` that holds the institution in `StartRow` (`start-row.tsx`) sets `required`, so its label reads "Instituição" without "(opcional)" (F7 of `slotted-locale.tsx`).

## A183 Zero results in Portuguese

The CLDR plural rule of `pt` classifies 0 as `one`, so the Slotted pt-BR message `{count, plural, one {# resultado} other {# resultados}}` reads "0 resultado". The pt entry of `web/src/i18n/languages.ts` passes a catalog that extends `PT_BR` and adds `=0 {Nenhum resultado}` to every count message of that form: `cascader.results`, `combobox.count`, `commandPalette.count`, `entityPicker.count`, `multiSelect.count`, `select.count`. Reason: the case belongs to the language; `PT_BR` is a dependency file that equori does not edit.

## A184 Known failures

- `pgtest.go:196`: the blank line the `wsl_v5` rule asks for.
- `cmd/equori/backup_cluster_test.go`: `dsnOf` returns a `postgres://` URL, and `TestClusterBackupDoesNotMigrate` sets `EQUORI_DATABASE_URL` from `dsnOf(pool)`. Reason: P14 specifies the URL form; the tests set a value that no supported configuration uses.
- The three figure tests: each `getByText`/`findByText` of an amount takes `moneyValue(<same text>)`. The expected texts are unchanged.
- The navigation map gains the entry `{"path": "/settings/appearance", "topics": ["settings_language_and_region"], "screen": "Appearance", "tasks": ["change the theme, colours, density and fonts"]}` after `/settings`. Reason: the studio is a screen a person reaches from the settings, and the assistant links screens by this map.

## A185 Check of the exit criteria of P10 to P15

The last task of the plan runs the tests that carry each exit criterion and records the result in the plan Review.

| Phase | Exit criterion | Evidence | Status after the check |
|---|---|---|---|
| P10 | Every test passes after the rename; a schema test rejects a business row without a book; each setting has one level and one source | `make check` | delivered (unchanged) |
| P11 | An HTTP test per role and per access without membership (404); login tests with TOTP, with a passkey and with a recovery code | `go test ./internal/identity/... ./internal/server/...`, S199 to S202 | delivered when the tests pass. The owner tasks of the P11 plans move to A186 |
| P12 | Replays of the October 2026 incidents; a stalled connection on the overview; a grouped entry without duplicate | `go test ./internal/ingestion/... ./internal/ledger/...`, S203 to S213, S234 to S240 | review until the A143 query runs on or after 2026-11-07 (plan `2026-10-31-p12-reliable-bank-connection.md`, Owner tasks) |
| P13 | An encrypted copy restored into an empty instance; the diagnostic file holds no book data | `TestClusterS216EncryptedCopyRestores` (`make test-cluster`), `TestS219DiagnosticHoldsNoBookData` | delivered when the tests pass |
| P14 | A clean machine of each system reaches first access with one pasted command | `make install-smoke` (Linux, S227); S233 for macOS and Windows | review until the release notes record S233 |
| P15 | P16 testers record their first transactions without outside help | S260 | delivered (unchanged); S260 confirms it |

Reason for P11 and P13: section 9.4.3 sets `delivered` once the exit criterion passes, and neither criterion names an owner check.

## A186 Owner tasks and the tag

The tag needs each item below. The release checklist (`docs/operations/release.md`) gains step 8: "Every P16 owner check of `docs/specs/2026-11-01-test-release-design.md`, A186, is recorded in the release notes with its date; `gh issue list --state open --label data-loss,duplication,exposure` prints nothing."

1. S233 (P14): macOS and Windows.
2. S260 (P15): at least two testers besides the owner install equori, follow the walkthrough and record their first transactions without outside help.
3. S261: the owner and the testers use real accounts of at least three banks, through Meu Pluggy or file import, for at least two weeks; each defect becomes a GitHub issue, and an issue of data loss, duplication or exposure carries the label of its kind.
4. The owner tasks of the P11 plans (Current state).
5. The A143 query of P12 and the grouped `match` after a real sync.
6. `git tag v1.0.0` and its push, by the owner, after steps 1 to 8 of the checklist.

## Regions

A181 reads Brazilian trade names from the catalogue of the `br_ispb` scheme. A183 adds a message case of the `pt` language. No other region-dependent value is introduced.

## Contract

- No migration, no operation, no `Problem.code`.
- Catalog: none in `web/src/i18n/catalog*.ts`; A183 adds six Slotted messages to the pt catalog.
- `docs/operations/release.md`: checklist step 8 (A186).

## Scenarios

| ID | Scenario | Test |
|---|---|---|
| S253 | An archive whose posting names an account of another book is refused with 422 `archive_invalid`; the importing book holds no new account | `internal/reporting/import_test.go` |
| S254 | An archive whose `ledger_transaction_version` row names a transaction of another book is refused with 409 `import_conflict` | `internal/reporting/import_test.go` |
| S255 | The catalogue search "Nubank" lists the entry of ISPB 18236120 named "Nubank" | `web/src/features/accounts/institution-catalogue.test.ts` |
| S256 | The search "Ita" lists "Itaú" before "Banco ItauBank" | `web/src/features/accounts/catalogue-search.test.ts` |
| S257 | The institution field of a walkthrough row reads "Institution" without "(optional)" | `web/src/features/start/start-page.test.tsx` |
| S258 | A pt-BR count message reads "Nenhum resultado" for 0 and "1 resultado" for 1 | `web/src/i18n/languages.test.ts` |
| S259 | The exit criteria of P10 to P15 are checked (A185) | Plan Review |
| S260 | Testers record their first transactions without outside help | Owner task |
| S261 | Real accounts of three banks for two weeks end with no open defect of data loss, duplication or exposure | Owner task |

## Out of scope

- The account tile of the "Pagar com" drawer that never reports stable to Playwright (S252, fourth finding): a person's click is unaffected, and no product rule covers it.
- A filter of private addresses for `base_url` (A178).
- An IP-based login throttle (A178): the throttle is per email.
- The tag and its push (A186).

## Left to the plan

The exact test tables of S253 to S258, the shape of the A179 check query, and the `pnpm` command of A180.
