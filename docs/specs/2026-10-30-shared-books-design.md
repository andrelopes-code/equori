# Shared books and setting levels: design

- Status: accepted
- Date: 2026-10-30
- Phase: P10 of `docs/domain/09-roadmap.md`, section 9.4
- Decision record: ADR 029
- Inputs: `tmp/ideas.md` section 07, ADR 003, the schema of the development database at migration 00068

## 1. Goal

Exit criterion of P10, quoted from section 9.4.2: "Every test passes after the rename; a schema test rejects a business row without a book; each setting has one level and one source."

P10 separates the person from the data. P11 then adds invitations, the switch of the active book and role enforcement without a second migration of business tables.

## 2. Terms

| Term | Definition |
|---|---|
| Books | The set of business data of one household or person. Every business row belongs to exactly one books. One books is "a book" in prose and `books` in identifiers. |
| Member | A person who logs in: email, password, instance role, language, appearance. |
| Membership | The link of one member to one book, with a book role. |
| Instance role | `admin` or `member`, on the member. An admin changes instance settings and creates members (ADR 003). |
| Book role | `owner`, `write` or `read`, on the membership. P10 creates only `owner`; P11 enforces the roles. |
| Active book | The book of the current session or access token. |
| Setting level | Where a setting is stored and who it applies to: environment, instance, book, member or browser. |

## 3. Current state

- 59 tables have a `user_id` column; 26 of them reference `identity_user (id)` directly; 73 composite foreign keys include `user_id`; 8 primary keys include it.
- Go code outside generated files has 865 lines with `UserID` in 173 files, and 196 calls of `auth.MustUserID`. Queries in `db/queries` have 505 lines with `user_id`.
- `identity_user` holds the person (email, password, role, language) and the owner of the data (region).
- Sealed values bind the user ID as associated data (ADR 008, K3): `ingestion_integration` credentials and `assistant_provider.sealed_key`.
- Stored JSON names the user: `ledger_transaction_version.snapshot` (key `user_id`) and the payload of the events `identity.user_created.v1` and `.v2`.
- The archive (ADR 021) selects its tables by the column `user_id` and strips that column from each row (`internal/reporting/internal/adapter/postgres/archive.go`).
- Settings come from three places: environment variables, database columns keyed by user, and `localStorage` keys of the browser (section 5).

## 4. Decisions

### 4.1 Schema

| ID | Decision |
|---|---|
| BK1 | `identity_user` is renamed `identity_member`. It keeps `id`, `email`, `password_hash`, `role` (the instance role), `disabled_at`, `created_at` and `language`. It gains `appearance jsonb NOT NULL DEFAULT '{}'` (BK21). The column `region` moves to the book. |
| BK2 | `identity_books`: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `region text NOT NULL` with the check of the current `identity_user.region`, `time_zone text` (null means the region's default, BK18), `created_at timestamptz NOT NULL`. |
| BK3 | `identity_membership`: `member_id` references `identity_member (id) ON DELETE CASCADE`, `books_id` references `identity_books (id) ON DELETE CASCADE`, `role text NOT NULL CHECK (role IN ('owner', 'write', 'read'))`, `created_at timestamptz NOT NULL`, primary key `(member_id, books_id)`, index on `books_id`. Book roles are universal and closed, so a closed `CHECK ... IN` applies (ADR 016, X9). |
| BK4 | Backfill in the same migration: each member gets one book with the same `id` (`OVERRIDING SYSTEM VALUE`) and its former `region`, and one membership with role `owner`. The identity sequence of `identity_books` continues after the highest `id`. Reason: equal IDs keep every sealed value readable (ADR 008, K3) and every composite key valid, without a rewrite of business rows. |
| BK5 | Every direct reference of a business table to `identity_user (id)` is replaced by `REFERENCES identity_books (id) ON DELETE CASCADE`, under the same constraint name. Every business table then renames `user_id` to `books_id`. Composite foreign keys, primary keys and indexes stay as they are: PostgreSQL binds them to the column, not to its name. Existing constraint and index names that contain `user_id` are not renamed. |
| BK6 | `identity_session` and `identity_access_token` rename `user_id` to `member_id` and gain `books_id bigint NOT NULL`, backfilled with the value of `member_id`. The pair `(member_id, books_id)` references `identity_membership ON DELETE CASCADE`. A removed membership therefore removes its sessions and tokens. |
| BK7 | The migration rewrites stored JSON: the top-level key `user_id` of `ledger_transaction_version.snapshot` becomes `books_id`. Stored events of type `identity.user_created.v1` and `.v2` stay as delivered history; BK13 replaces the event. |
| BK8 | A schema test proves the invariant: an insert into each table with `books_id` and an unknown book is rejected, and an insert with a null `books_id` is rejected. A catalog test fails when any table in the schema has a column `user_id`, or a column `books_id` without a foreign key to `identity_books`. |

### 4.2 Identity of a request

| ID | Decision |
|---|---|
| BK9 | `internal/platform/auth` exposes `WithIdentity(ctx, memberID, booksID)`, `MustMemberID(ctx)` and `MustBooksID(ctx)`. `WithUserID`, `UserID` and `MustUserID` are removed. A missing value panics, as `MustUserID` does today. |
| BK10 | `identity.RequireSession` and the bearer check of `/mcp` read the member and the book from the session or token row and put both in the context, with the book's location (BK19). |
| BK11 | Creating a member, by `equori user create` or by `POST /api/v1/setup`, creates the member, a book with the region of the input and a membership `owner`, in one transaction. |
| BK12 | Login opens the session in the book of the member's `owner` membership with the lowest `books_id`. An access token is created in the active book of the session that creates it. P11 replaces the login rule with the last active book. |
| BK27 | `identity.Module.Profile(ctx, booksID)` returns the region of the book and the language of the member in the context. Without a member in the context (schedulers, event handlers), the language is that of the book's owner with the lowest member ID. `IsAdmin` takes a member ID. |
| BK13 | The event `identity.user_created.v2` is replaced by `identity.books_created.v1` with `books_id`, `region` and `base_currency`. Its consumers (`ledger_settings` and every other handler of the old event) move to the new event. A member event is out of scope: no consumer needs one in P10. |

### 4.3 Code rename

| ID | Decision |
|---|---|
| BK14 | Every business module takes the book: `userID` becomes `booksID`, `UserID` becomes `BooksID`, and `user_id` becomes `books_id` in `db/queries`. The rename is mechanical and runs as a script of the plan. sqlc and oapi-codegen regenerate the generated files. |
| BK15 | Exceptions keep the member: the member, session, access token, setup and profile code of `identity`; `cmd/equori/user.go`; log fields of login. These names become `memberID` and `MemberID`, not `booksID`. |
| BK16 | Text that names the user as owner of data becomes the book: comments, log messages, problem details and API descriptions (for example ADR 019 P6 "the user's providers" becomes "the book's providers"). |
| BK17 | The test harness (`internal/apitest`) creates one unused book before its first member. In every HTTP test the member ID therefore differs from the books ID, and code that passes one for the other fails a test. The JSON fields named `user_id` in the HTTP contract, if any, become `books_id` or `member_id` by the same rule. |

### 4.4 Time zone per book

| ID | Decision |
|---|---|
| BK18 | `DefaultTimeZone(region)` in `internal/identity/region_defaults.go` returns `America/Sao_Paulo` for `BR` and `UTC` for every other region. A new row in `docs/contributing/regions.md` names this extension point. |
| BK19 | The location of a book is its `time_zone`, or `DefaultTimeZone(region)` when null. `clock.Clock.Today()` becomes `Today(ctx)`, computed in the location of the context. Without a location in the context, `Today(ctx)` uses UTC; only instance work runs without one (market data ticks, `assistant_usage` days). |
| BK20 | Schedulers (`ingestion` sync and `planning` occurrences) iterate books and give each run the context of its book. `EQUORI_TIMEZONE` is removed. Backup file names use UTC. |

### 4.5 Setting levels

| ID | Decision |
|---|---|
| BK21 | Appearance follows the member. `GET /api/v1/me/appearance` returns the stored object; `PUT /api/v1/me/appearance` replaces it. The server checks only that the body is a JSON object of at most 16 KiB (422 `appearance_too_large`); the web validates each value on read, as it validates `localStorage` today. The browser keeps a copy for the first paint and overwrites it with the server's value after login. |
| BK22 | The book's settings move to `GET` and `PATCH /api/v1/books/current`: `region` and `time_zone`, plus the derived `default_time_zone`. `region` leaves `PATCH /api/v1/me`; `language` stays there. An unknown IANA name is 422 `time_zone_invalid`. Null restores the region default. |
| BK23 | The sync interval moves to the instance. Table `ingestion_instance_settings`: one row at most, `sync_interval_minutes integer NOT NULL CHECK (sync_interval_minutes BETWEEN 1 AND 1440)`. No row means 60. `GET` and `PUT /api/v1/ingestion/sync-schedule` read and change it; `PUT` by a member without the `admin` instance role is 403 `admin_required`. The scheduler reads the value before each cycle. `EQUORI_SYNC_INTERVAL` is removed. |
| BK24 | `EQUORI_GEMINI_API_KEY` and `EQUORI_GEMINI_URL` are removed. The key becomes a provider of preset `aistudio` on the assistant settings screen of the book (ADR 019). `server.Config.LLMProviders` stays: tests inject instance providers through it, and production passes none. |
| BK25 | `EQUORI_PRICE_FEEDS` and `EQUORI_INDEX_FEEDS` are removed. The enabled feeds are the rows of `marketdata_feed` (ADR 025, F2 without its fallback). `server.Config.PriceFeeds` and `IndexFeeds` stay for tests, as in BK24. |
| BK26 | A removed variable that is still set produces one warning at start-up. The warning names the variable and the screen that replaces it. Start-up does not fail. |

## 5. Classification of every setting

Environment level holds only values needed before the database opens, security boundaries, and host or network values (section 9.4.1).

| Setting | Level | Source |
|---|---|---|
| `EQUORI_DATABASE_URL`, `EQUORI_DATA_DIR`, `EQUORI_POSTGRES_BIN`, `EQUORI_BACKUP_DIR`, `EQUORI_LOG_LEVEL` | Environment | Variable (needed before the database opens, or host) |
| `EQUORI_HTTP_ADDR`, `EQUORI_WEB_DEV_PORT`, `EQUORI_AGGREGATOR_<ID>_URL`, `EQUORI_FEED_<ID>_URL` | Environment | Variable (network) |
| `EQUORI_SECRET_KEY`, `EQUORI_SECRET_KEY_PREVIOUS`, `EQUORI_INSECURE_COOKIES`, `EQUORI_API_DOCS` | Environment | Variable (security boundary) |
| Enabled market data feeds | Instance | `marketdata_feed` (BK25) |
| Sync interval | Instance | `ingestion_instance_settings` (BK23) |
| Region | Book | `identity_books.region` |
| Time zone | Book | `identity_books.time_zone` (BK18, BK19) |
| Base currency | Book | `ledger_settings.base_currency` |
| Budget reference | Book | `planning_budget_reference` |
| Language model providers, chains, usage limits | Book | `assistant_provider`, `assistant_chain_target`, `assistant_usage_limit` (BK24) |
| CSV import profiles | Book | `ingestion_csv_profile` |
| Language | Member | `identity_member.language` |
| Appearance: `equori.accent`, `.contrast`, `.corners`, `.density`, `.depth`, `.motion`, `.scheme`, `.success`, `.textSize`, `.tone`, `.typeface`, `.themes`, `.visual` | Member | `identity_member.appearance` (BK21) |
| Privacy mode `equori.privacy` | Browser | `localStorage` (ADR 018, P1) |
| Navigation layout `equori.nav`, entry form `equori.entry.form` | Browser | `localStorage` |
| Language before login `equori.locale` | Browser | `localStorage`, overwritten by the member's language after login |
| `equori.capture.defaultAccount`, `equori.capture.queue`, `equori.recent-categories`, `equori.plan.collapsed` | Browser | `localStorage` under `<key>.<booksId>`: the values hold IDs of one book (households access HA29) |
| `equori.device.user` | Browser | `localStorage`, keeps its name and holds `booksId`, the active book of the last online session (households access HA30) |

`EQUORI_TEST_LOG` and `EQUORI_DEMO_PASSWORD` configure test and demo tools, not the application, and stay out of the table.

## 6. Archive

- `FactTables` selects tables by the column `books_id`; each row drops `books_id` instead of `user_id`. The archive format does not change, so its schema version does not change (ADR 021).
- An archive written before P10 imports unchanged: its rows carry no owner column.

## 7. Scenarios

| ID | Scenario |
|---|---|
| S186 | A member created through setup gets one book with the region given at setup, an `owner` membership, and ledger settings of that book with the base currency given at setup. |
| S187 | Two members of one instance each see only the rows of their own book. |
| S188 | At 2026-10-30 20:00 UTC, an operation whose answer depends on today uses 2026-10-31 for a book in `Asia/Tokyo` and 2026-10-30 for a book of region `BR` without a time zone. The plan names the operation. |
| S189 | Appearance saved through one session is returned to a second session of the same member. |
| S190 | A member with the `member` instance role receives 403 `admin_required` on `PUT /api/v1/ingestion/sync-schedule`; an admin's change is returned by `GET`. |
| S191 | A session whose membership is deleted is rejected with 401 on its next request. |

`time_zone_invalid` and `appearance_too_large` each get an HTTP test (CONTRIBUTING, Tests).

## 8. Documents changed with the code

- ADR 003: the section "Users and data isolation" is replaced by ADR 029; an amendment records the replacement.
- ADR 005, section 3: the time zone is the book's (BK19).
- ADR 019: P6 and P7 read "book" for "user"; the bullet on `EQUORI_GEMINI_API_KEY` is removed (BK24).
- ADR 025: F2 loses the environment fallback (BK25).
- `CONTRIBUTING.md`: "Every business table has `books_id`"; handlers get the book with `auth.MustBooksID(ctx)`.
- `docs/domain/02-ubiquitous-language.md`: Books, Member, Membership, Book role, Instance role.
- `docs/domain/07-data-model.md`: every `user_id` becomes `books_id`; the three identity tables.
- `docs/contributing/regions.md`: the row of BK18.
- Every guide, example `.env` and compose file that names a removed variable.

## 9. Owner tasks

- Enter the Gemini key as an `aistudio` provider on the assistant settings screen.
- Enable the market data feeds on the feeds screen.
- Set the sync interval on the instance screen when it differs from 60 minutes.
- Remove `EQUORI_TIMEZONE`, `EQUORI_SYNC_INTERVAL`, `EQUORI_GEMINI_API_KEY`, `EQUORI_GEMINI_URL`, `EQUORI_PRICE_FEEDS` and `EQUORI_INDEX_FEEDS` from `.env` and `~/.config/equori/local.env`.

## 10. Out of scope

| Item | Phase |
|---|---|
| Invitation, switch of the active book, enforcement of book roles, book names | P11 |
| Privacy of assistant conversations between members of one book | P11 |
| Transfer between books, consolidated report, shared expense across books | After 1.0 (section 9.4.4) |
| Renaming constraint and index names that contain `user_id` | Not planned |
| Row-level security in PostgreSQL | Not planned |

## 11. Plans

P10 is executed in three plans, in this order (section 9.4.3):

1. Identity: BK1 to BK4 (without the `appearance` column, which plan 3 adds), the foreign keys of BK5, BK6, BK9 to BK13, BK17, BK27, S186, S191. Business tables keep the column name `user_id`, whose values are books IDs from this plan on. `auth.WithUserID`, `UserID` and `MustUserID` stay as wrappers of the books ID until plan 2.
2. Rename: the column rename of BK5, BK7, BK8, BK14 to BK16, S187. The column rename and the code rename land in one commit, because sqlc reads the schema.
3. Settings: BK18 to BK26, S188 to S190, the documents of section 8.
