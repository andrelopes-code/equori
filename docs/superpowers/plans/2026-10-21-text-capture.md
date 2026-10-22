# Text capture

Spec: `docs/superpowers/specs/2026-10-21-text-capture-design.md` (A106–A116, S99–S112). Work happens in the main working tree, beside the uncommitted account-picker work; the checkpoint lists the files of this plan.

## Slice 1 — ledger transaction batch (A114)

1. `ledger/internal/app`: extract the body of `InstallmentPurchase` into a function over a `Repository`; `RecordBatch(ctx, userID, []BatchEntry)` runs every entry in one `InTx` and prefixes field errors with `entries[i].<member>.`.
2. `api/openapi.yaml`: `POST /transaction-batches` (`createTransactionBatch`), schemas `TransactionBatchInput`, `BatchEntry`, `TransactionBatch`; `make gen`; handler in `httpapi`; exclusion in `internal/server/tool_exposure_test.go`.
3. `internal/ledger/transaction_batch_test.go` through `apitest`: S111, S112, an entry with both members, an entry with neither.

## Slice 2 — capture grammar (A107–A113, pure)

4. `internal/capture/internal/domain`: line split, words, normalization, amount (A108), date (A109), installments (A110). Table tests.
5. Accounts and method words (A111), kind (A112), tags and description (A113). Table tests.
6. `Read(text, Vocabulary, today, defaultAccount) []Line` assembling drafts, segments and issues. Table tests for S99–S110 without classification.

## Slice 3 — capture module

7. `ledger.Module.CaptureVocabulary` (candidate accounts with institution names and active card last fours; payees) and `classification.Module.DecideManual` (F5 for origin `manual`).
8. `internal/capture`: `app.Service.Preview`, module root, `httpapi` from `POST /capture/preview` (tag `capture`, `oapi-codegen.yaml`), wiring in `internal/server`, depguard entries, exclusion in `tool_exposure_test.go`.
9. `internal/capture/preview_test.go` through `apitest`: S99–S110 and `too_many_lines`.

## Slice 4 — web

10. `features/capture/api.ts` (preview query, batch mutation), `overrides.ts` (keys by text and occurrence), `entries.ts` (drafts to batch entries). Unit tests.
11. Components: `capture-page.tsx`, `capture-line.tsx` (segments, fields, issues, choices), `capture-edit-dialog.tsx`. Catalog keys in both languages.
12. Route `/transactions/capture`, links between both forms, last-used form for `N` and the dock. Page tests.

## Slice 5 — closure

13. `docs/domain/06-scenarios.md` (S99–S112 and the coverage note), `docs/domain/04-contexts.md` (Capture context).
14. `make check`; Slotted review of the screen; Slotted findings in the reply.
