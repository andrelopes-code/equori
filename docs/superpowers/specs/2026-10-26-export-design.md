# Export and import round trip

SC6 (`docs/domain/01-vision.md`), N13 (`docs/domain/08-non-functional-requirements.md`) and the "Export (SC6)" row of `docs/domain/07-data-model.md` section 7.7. Reporting owns the export (`docs/domain/04-contexts.md`).

## Intent

The owner takes every fact of the books out of an instance in an open format, at any time. The same archive, imported by an owner without data on any instance of the same schema version, reproduces every fact, and the derived values follow from the existing rebuilds.

## E1 Archive

A ZIP file named `equori-export-<date>.zip`, `<date>` being the request date in ISO 8601.

| Entry | Content |
|---|---|
| `manifest.json` | `format` (`equori-export`), `format_version` (1), `schema_version` (the highest applied goose version), `exported_at` (RFC 3339), `tables` (name, file, rows, SHA-256 of the file), `attachments` (file, SHA-256) |
| `tables/<table>.jsonl` | One JSON object per row, as `to_jsonb` writes it, without `user_id`; rows ordered by every column of the primary key |
| `attachments/<sha256>` | The bytes of `ledger_attachment_blob.content`; the row in `ledger_attachment_blob.jsonl` carries every other column |

A `bytea` value is written as `to_jsonb` writes it (`\x` and hexadecimal). Identifiers stay as they are: UUIDv7 values are stable across instances (DD2).

## E2 Tables

| Group | Tables | In the archive |
|---|---|---|
| Facts | every table with a `user_id` column not listed below, and `ledger_transaction_version` through its transaction | rows of the user |
| Shared | `marketdata_instrument`, `marketdata_price`, `marketdata_fixed_income_terms`, `marketdata_index_rate`, `marketdata_holiday` | every row |
| Derived | `reporting_account_day`, `portfolio_position_day`, `portfolio_realized_result`, `portfolio_income_event`, `capture_category_hint` | no |
| Identity and delivery | `identity_user`, `identity_session`, `outbox_event`, `outbox_delivery`, `goose_db_version` | no |
| Secrets and usage | `assistant_provider` (sealed key), `assistant_chain_target`, `assistant_usage`, `assistant_usage_limit`, `reporting_export` | no |

`ingestion_integration` is a fact without its credential: `credential_ciphertext` is written as an empty value. The ciphertext is sealed under the source instance key and bound to the source user (ADR 008), so no other instance or user opens it. After an import the integration answers 409 `integration_unavailable` until the owner enters the credentials again; key rotation skips an empty value.

The list of fact tables is read from the database catalog at run time, so a new table with `user_id` is exported without a code change. A schema test fails when a table is neither a fact nor named in the table above.

## E3 Operations

| Operation | Contract |
|---|---|
| `requestExport` `POST /exports` | 202 with the export `{id, status: pending, requested_at}`. Replaces the user's previous export. 409 `export_pending` while one is pending. |
| `getExport` `GET /exports/current` | The user's export: `status` `pending`, `ready` or `failed`, `requested_at`, `finished_at`, `size`, `sha256`, `problem` (code of a failure). 404 when none was requested. |
| `getExportContent` `GET /exports/current/content` | The archive, `application/zip`, `Content-Disposition: attachment`. 409 `export_not_ready` unless `ready`. |
| `importArchive` `POST /imports/archive` | Multipart with one `file`. 200 with `{tables: [{name, rows}]}` in import order. |

`requestExport` writes a `reporting_export` row and the outbox event `reporting.export_requested` in one transaction (ADR 006). The reporting handler builds the archive inside one `REPEATABLE READ` read-only transaction, so every table comes from one snapshot, and stores it in `reporting_export.content`. A failed build sets `failed` and `problem`; it is not retried, because the same snapshot rules produce the same failure.

## E4 Import

1. The archive is read whole. A missing or unreadable manifest, a file whose SHA-256 differs from the manifest, or a row that is not a JSON object: 422 `archive_invalid`. A `schema_version` other than the instance's: 422 `archive_version_mismatch`.
2. The user must hold no fact: no row in `ledger_transaction`, and no row in `ledger_account` without a system role. Otherwise 409 `import_not_empty`.
3. In one transaction: the user's rows of every fact table are deleted, child tables first; this removes the system accounts and settings written at sign-up. Shared rows are inserted with `ON CONFLICT DO NOTHING`. Fact tables are inserted in the order of their foreign keys, computed from the catalog; each table is one `INSERT … SELECT FROM jsonb_populate_recordset`, so a reference between rows of one table is checked at the end of the statement. `user_id` is set to the importing user.
4. A primary key already held by another user of the instance: 409 `import_conflict`, and nothing is written.
5. After the commit, the derived tables are rebuilt for the user: the balance series of every account (`equori reporting rebuild`, per user) and the positions, results and income events (`equori portfolio rebuild`, per user).

ADR 002 states that only the owner module writes its tables. The import is a restore of whole tables and runs in `reporting`; ADR 002 gains a dated amendment that names it as the one exception.

## E5 Limits

| Limit | Value | Over it |
|---|---|---|
| Archive size | 256 MiB | `failed` with `export_too_large`; on import, 413 from the body limit |
| Exports kept per user | 1 | the next request replaces it |

The archive is built in memory: one export holds at most 256 MiB of the process memory.

## E6 Round trip test (N13)

`internal/reporting/export_test.go` runs two harnesses, each on its own database:

1. On the first, a user records accounts, a card with an installment purchase, transactions with tags and an attachment, a trade, a schedule with a realized occurrence, a budget and a rule.
2. The archive is exported and downloaded, then imported by a new user of the second database.
3. A new export of the second user equals the first archive in every table file and attachment.
4. Derived values are equal on both: `listAccounts` balances, `getNetWorth`, `getCategoryTotals` of the month, `listPositions` and `getCommitment`.

## Web

A section of `/settings` requests the export, shows its status and size, downloads a ready archive, and imports an archive when the books are empty.

## Out of scope

- Import of an archive of another schema version. The archive names its version, so a migration of archive rows can be added later.
- Merging an archive into books that hold facts.
