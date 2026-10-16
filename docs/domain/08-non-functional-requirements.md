# 8. Non-functional requirements

Status: approved

Every requirement has a measurable criterion and a verification method. Performance targets refer to the reference deployment below.

## 8.1 Reference deployment and dataset

| Item | Value |
|---|---|
| Host | 2 vCPU, 4 GiB RAM, SSD; application and PostgreSQL on the same host |
| Dataset | 10 years of history: 50,000 transactions, 150,000 postings, 40 balance accounts, 150 categories, 120 statements per card, 200 schedules |

## 8.2 Correctness

| ID | Requirement | Verification |
|---|---|---|
| N01 | Every scenario of chapter 6 passes as an acceptance test against PostgreSQL. | `make check` |
| N02 | Invariants I01–I10 hold for randomly generated valid and invalid operations: valid ones are accepted and keep every invariant; invalid ones are rejected without partial writes. | Property-based tests |
| N03 | All monetary arithmetic uses integers; conversions round half to even exactly once (ADR 005, chapter 5). | Lint rule forbidding `float32`/`float64` in `domain` packages; unit tests |
| N04 | The database rejects an unbalanced transaction written by raw SQL. | Database test of the deferred trigger (7.6) |

## 8.3 Performance

| ID | Requirement | Verification |
|---|---|---|
| N05 | p95 latency below 200 ms for list, balance, statement and report endpoints on the reference dataset. | Benchmark suite with seeded dataset |
| N06 | Balance of one account at any date: below 50 ms. | Benchmark |
| N07 | Import of an OFX file with 1,000 records: below 5 s, including deduplication, matching and categorization. | Benchmark |
| N08 | Full rebuild of derived tables (balance series, positions) for the reference dataset: below 60 s. | Benchmark |
| N09 | Application memory below 256 MiB RSS under normal use. | Container metrics |

## 8.4 Reliability and data safety

| ID | Requirement | Verification |
|---|---|---|
| N10 | A committed change is never lost; a cross-module reaction is never lost (ADR 006). | Crash test between commit and dispatch |
| N11 | Migrations are forward-only, transactional and applied at startup; a failed migration leaves the previous schema intact and stops the application. | Migration tests on a copy of the reference dataset |
| N12 | Backup and restore are documented (`docs/operations/backup.md`); a restored backup reproduces every table, balance, derived series and trigger of the original. | `internal/server/backup_test.go` in `make check` |
| N13 | Export (SC6) followed by import into an empty instance reproduces every fact and every derived value. | Round-trip test |

## 8.5 Security and privacy

| ID | Requirement | Verification |
|---|---|---|
| N14 | Authentication and session rules of ADR 003. | Identity tests |
| N15 | Aggregator credentials are encrypted at rest with a key outside the database (ADR 008). | `internal/platform/secret` tests; `TestConnectItemAndMapAccounts` (no credential in clear in the database); `TestCredentialsBoundToTheirRow`; `TestSecretRotation` |
| N16 | Logs never contain passwords, session tokens, credentials or full account numbers. | Log tests on login and import; P6 log captures with no client secret, API key, item id or account number (`TestConnectItemAndMapAccounts`, `TestIntegrationCredentials`, `TestTwoIntegrations`, `TestTickWithTwoIntegrations`); `TestClientErrorsCarryNoIdentifiers` |
| N17 | No telemetry. The application contacts only configured integrations and price feeds. | `TestClientRefusesForeignCursor` (Pluggy requests stay on the configured base URL); network allowlist test in the container |
| N18 | Dependencies scanned on every CI run and updated weekly. | `govulncheck`, Dependabot |

## 8.6 Auditability

| ID | Requirement | Verification |
|---|---|---|
| N19 | For every transaction: its versions, the instant of each change, its origin and, when imported, the external record and batch. | API and tests |
| N20 | Every derived value names its inputs: a yield transaction names its assertion; a cash-view amount names its statement and payment. | Scenario tests S24, S30 |

## 8.7 Usability and localization

| ID | Requirement | Verification |
|---|---|---|
| N21 | Interface languages: Brazilian Portuguese and English. Number, currency and date formats follow the selected locale. | UI tests |
| N22 | Manual expense entry with at most three inputs (SC4). | UI test |
| N23 | Every list that grows with use is paginated, and every list follows the filter rules of ADR 005 (ADR 007, C8). | API tests per list |

## 8.8 Compatibility and limits

| ID | Requirement |
|---|---|
| N24 | Container images for linux/amd64 and linux/arm64; PostgreSQL 18. |
| N25 | Browsers: the last two major versions of Chrome, Firefox, Safari and Edge. |
| N26 | Limits: 500 postings per transaction; 420 installments per plan; 10 MiB per attachment and per imported file; 1 MiB per request body except attachment upload and file import (11 MiB). |
