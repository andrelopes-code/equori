# P3.5 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps in error responses, request validation, API conventions, security headers and backup found before P4, while the API has no client.

**Architecture:** `api/openapi.yaml` becomes an enforced contract: a platform middleware validates every `/api/v1` request against it before the module handlers run. Field-shape rules move into the contract; the domain keeps business rules. ADR 007 fixes the API conventions every later phase follows.

**Tech Stack:** As P3. New dependency: `github.com/getkin/kin-openapi` (packages `openapi3`, `openapi3filter`, `routers`), already in `tools/go.mod` through oapi-codegen; approving this plan approves the dependency, recorded in ADR 007.

**Spec:** ADR 004, ADR 005, `docs/domain/08-non-functional-requirements.md` (N12, N23, N26); this plan's "Decisions".

## Evidence (probe of 2026-10-16)

| Request | Response today |
|---|---|
| `POST /accounts` with an unknown member `colour` | 201, member ignored |
| `PATCH /accounts/{id}` with `nmae` | 200, nothing changed |
| amount as a string, UUID `not-a-uuid`, date `2026-13-01`, `limit=0`, invalid cursor | 400 `invalid_request`, detail "malformed request", no `errors` |
| account with four invalid fields | 422 with one entry in `errors` (ADR 004 requires one per field) |
| body with `Content-Type: text/plain`; JSON followed by `{}` | 201 |
| `DELETE /accounts` | 404 instead of 405 |
| any 201 | no `Location` header |
| statement summary | `opening`, `charges`, `credits`, `amount_due`, `payments`, `unpaid` are integers without currency |
| lists | only `/transactions` paginated (N23 requires every list) |
| responses | no `X-Content-Type-Options`, `Content-Security-Policy`, `Referrer-Policy`, `Cache-Control` |
| backup | N12 neither documented nor tested |

## Decisions (ADR 007, approved with this plan)

| ID | Decision |
|---|---|
| C1 | Every `/api/v1` request is validated against `api/openapi.yaml` before the handler. A violation returns **400 `invalid_request`** with one `errors` entry per violation: body members as `postings[0].amount`, parameters by name (`limit`, `id`). A request that conforms but breaks a domain rule returns **422** (`validation_failed` or a specific code) with the field of the first broken rule. ADR 004 is amended accordingly. |
| C2 | Request schemas declare `additionalProperties: false`; an unknown member is a violation. |
| C3 | Field-shape rules live in the contract: required members, `minLength`/`maxLength`, `enum`, `pattern`, `minimum`/`maximum`, `maxItems` (500 postings, N26). The domain re-checks them as defense; the contract reports them all at once. |
| C4 | A request body must have the media type the operation declares: otherwise **415 `unsupported_media_type`**. A JSON body is exactly one value. |
| C5 | A path that exists with another method returns **405 `method_not_allowed`** with an `Allow` header. |
| C6 | Endpoints: a sub-collection noun creates a record (`/payments`, `/refunds`, `/disputes`, `/financing`, `/cancellation`, `/anticipation`, `/balance-assertions`, `/attachments`) and returns **201** with the record and, when the record has a GET endpoint, a `Location` header. A state transition without a new record is `POST /<resource>/{id}/<verb>` (`void`, `close`, `unlock`, `resolve`, `reconcile`) and returns **200** with the updated resource. |
| C7 | Every monetary value in a response is `Money`. |
| C8 | Lists that grow with use paginate by cursor (ADR 005): accounts, institutions, payees, tags, statements, balance assertions, attachments, transactions. Lists bounded by one parent record or by a requested range return all items without a cursor: holidays of a year, balance series, transaction versions, cards, credit limits, billing cycle rules. N23 is amended accordingly. |
| C9 | Every response carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`; `/api/` responses add `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` and `Cache-Control: no-store`. |

## Global Constraints

- All P1–P3 constraints apply. These changes break the API contract; commits use `feat(api)!:` or `feat(<module>)!:` with a `BREAKING CHANGE:` footer.
- A test whose expected status changes from 422 to 400 cites C1 in the commit body (test rules in `CLAUDE.md`).
- Multipart bodies are validated for media type only; the content of an upload is never buffered by the validator.

## Review Focus

1. A request valid under the contract but rejected by the domain still returns 422 with its field (no business error turns into 400) (Task 2).
2. An attachment upload of 10 MiB passes the validator; the validator does not read the multipart body (Task 2).
3. Unknown `/api/` path: 404 problem; known path, wrong method: 405 with `Allow`; unauthenticated request with an invalid body: 401, not 400 (Task 2).
4. A cursor produced by one list and sent to another list: 400 `invalid_request` on `cursor`, never a wrong page (Task 6).
5. Security headers are present on problem responses written by the middleware itself (404, 405, 413, 500) (Task 7).

---

## Slice A (Tasks 1–3)

### Task 1: ADR 007 and amendments

**Files:** `docs/adr/007-api-conventions.md`, `docs/adr/004-api-errors.md`, `docs/adr/005-cross-cutting-conventions.md`, `docs/domain/08-non-functional-requirements.md` (N23).

Content: decisions C1–C9 with the kin-openapi dependency; ADR 004 gains the 400/422 split and codes `unsupported_media_type`, `method_not_allowed`; ADR 005 pagination section points to C8.

Commit `docs: add API conventions decision record`.

### Task 2: Contract validation middleware

**Files:** `api/embed.go` (package `api`, embeds `openapi.yaml`), `internal/platform/contract/contract.go` and test, `internal/server/server.go`, `internal/apitest` (raw request helper), `api/openapi.yaml` (`additionalProperties: false` on request schemas; codes in `Problem.code`).

```go
package contract // Validates /api/v1 requests against api/openapi.yaml (ADR 007).
func New(spec []byte) (*Validator, error)          // loads and validates the document once at startup
func (v *Validator) Middleware(next http.Handler) http.Handler
```

**Rules:** routes are an `http.ServeMux` built from the document (`METHOD /api/v1/path`, same `{param}` syntax), which yields 405 with `Allow`; `openapi3filter.ValidateRequest` with `MultiError: true`; schema errors map JSON pointers to `a[0].b` paths; multipart bodies skip body validation; the body is restored for the handler. Composition: `Middleware(RequireSession(contract.Middleware(mux)))`. Non-`/api/` routes pass through.

**Tests:** every row of the Evidence table that concerns requests (unknown member, typo in PATCH, wrong type, invalid UUID, invalid date, `limit=0`, invalid cursor format, `text/plain`, trailing value, DELETE on a GET path), each asserting status, `code` and every `errors` entry; Review Focus 1–3.

Commit `feat(api)!: validate requests against the API contract`.

### Task 3: Field rules in the contract and one error writer

**Files:** `api/openapi.yaml` (C3 on every request schema), `internal/platform/problem` (`Responder`: request ID, 5xx logging, transport and contract errors), the four modules' `adapter/httpapi` (map only their domain errors), tests whose status changes per C1.

**Tests:** an account with four invalid fields returns four `errors` entries; a transaction with 501 postings returns 400 on `postings`; each module still maps its domain errors (existing suite).

Commit `feat(api)!: declare field rules in the contract`.

**Slice A ends: checkpoint.**

---

## Slice B (Tasks 4–6)

### Task 4: Endpoint conventions (C6)

**Changes:** `POST /transactions/{id}/void` → 200 `Transaction`; `POST /accounts/{id}/close` → 200 `Account`; `POST /accounts/{id}/unlock` → 200 `ReconciliationStatus`; `/disputes/{id}/resolution` → `/disputes/{id}/resolve` 200 `Dispute`; `/balance-assertions/{id}/resolution` → `/balance-assertions/{id}/resolve` 200 `AssertionResult`; `/statements/{id}/reconciliation` → `/statements/{id}/reconcile` 200 `StatementDetail`; `Location` on 201 for accounts, transactions (including payments, refunds, cancellation, anticipation), institutions, payees.

**Tests:** each renamed endpoint through the API with its new status and body; `Location` resolves with GET to the created record.

Commit `feat(ledger)!: apply endpoint conventions`.

### Task 5: Money in every response (C7)

**Changes:** `StatementSummary` and `StatementDetail` amounts become `Money`; `StatementDetail` gains `reconciled` (boolean, A7); any other integer amount found by reading every response schema of the contract.

**Tests:** statement summary and detail assert `amount` and `currency`; a reconciled statement reports `reconciled: true`.

Commit `feat(ledger)!: return statement amounts as money`.

### Task 6: Pagination of growing lists (C8)

**Changes:** keyset queries with `limit + 1` and `page.Trim` for accounts (`account_class, lower(name), id`), institutions and payees (`lower(name), id`), tags (`name`), statements (`reference_month, id`), balance assertions (`date DESC, id DESC`), attachments (`created_at, id`); responses gain `next_cursor`. Each list's cursor key type has member names unique to that list, so a foreign cursor fails strict decoding.

**Tests:** per list, two pages with `limit=1` cover every item once in order; Review Focus 4.

Commit `feat(ledger)!: paginate growing lists`.

**Slice B ends: checkpoint.**

---

## Slice C (Tasks 7–9)

### Task 7: Security headers (C9)

**Files:** `internal/platform/httpserver/middleware.go` and test.

**Tests:** headers present on a 200, a handler problem and a middleware problem (404, 413); Review Focus 5.

Commit `feat(platform): send security headers`.

### Task 8: Backup and restore (N12)

**Files:** `docs/operations/backup.md` (dump with `pg_dump -Fc` in the database container, restore into an empty volume, start the application, rebuild derived tables), README link, `internal/server/backup_test.go`.

**Test:** seeds the P1–P3 scenario data through the API, dumps the test database and restores it into a new database with `pg_dump`/`pg_restore` executed in the Compose database container (the one `make check` starts), restores with triggers enabled so I01–I09 are rechecked on load, starts the application on the restored database and compares every account balance and the reporting series with the original.

Commit `docs: document backup and restore` and `test(server): verify a restored backup`.

### Task 9: Documentation and closing

- README: API conventions summary pointing to ADR 007.
- `make check`, self-review against Review Focus, merge `--ff-only` into `main`, push, CI green, checkpoint, domain book republished if chapter 8 changed.

Commit `docs: describe API conventions`.

**Exit criterion: every row of the Evidence table returns the response C1–C9 require, each pinned by a test; N12 and N23 have passing tests.**
