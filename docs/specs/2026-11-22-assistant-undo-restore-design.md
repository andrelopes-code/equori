# Assistant: undo of a categorization and of a correction

- Date: 2026-11-22
- Amends: answer views design V19 (the inverse of an executed proposal)
- Owner, 2026-11-22: improve the undo of the assistant.

## 1. Problem

V19 undoes an executed proposal by running one inverse write that its tool derives. Counted on 2026-11-22: 14 of the 36 write tools of `internal/server/testdata/tools.json` derive one (`tool.WithUndo`). The two writes a member confirms most, `categorize_transactions` and `change_transaction`, derive none: one call of `categorize_transactions` gives one category to transactions that held different ones, so no call of an existing tool returns each to what it was.

## 2. Approaches

| Approach | Fails at |
|---|---|
| A write that returns transactions to a version of their history | adds one tool to the registry; declared to a model it passes the ceiling of G12 (U7) |
| An inverse made of one `change_transaction` per transaction | V19 runs one tool call; a set of calls is not atomic for the member and needs a new proposal kind |
| `categorize_transactions` takes one category per item, and its result keeps the earlier ones | covers the category alone, not the payee the same call sets, and not `change_transaction` |
| No change | the most frequent writes stay without undo |

Choice: the first. `ledger` already keeps every earlier version of a transaction (`Service.Versions`) and replaces a transaction by a full next state under an expected version (`Service.CorrectTransaction`); the write composes both. It gives up nothing the others keep. Evidence that would overturn it: a correction path that refuses the stored state of an earlier version of a transaction it accepted before.

## 3. Rules

- U1. Tool `restore_transaction`, effect write: `{items: 1 to 50 of {transaction_id, version}, reason}`. `version` is a version of the history of the transaction, as `get_transaction` lists it. `reason` is required and kept in the history.
- U2. For each item, the state the transaction had at `version` becomes its next version, through `CorrectTransaction` with the current version as the expected one. Each item runs in its own database transaction, in request order. The result holds one status per item: `restored`, `not_found`, `version_unknown` (no such version in the history), `version_conflict`, `transaction_voided` or `not_restorable` (any other refusal of the correction).
- U3. The preview names the transactions as items, the reason as its change, and a basis made of each transaction and its current version: a transaction that changes after the proposal makes it stale (ADR 020 C7).
- U4. A result item of `categorize_transactions` with status `categorized` gains `version`, the version the transaction held before the call. The inverse of the call is `restore_transaction` over those items; a call that categorized nothing has no inverse.
- U5. The inverse of `change_transaction` with action `correct` is `restore_transaction` to the version before the one its result names. `make_transfer` and `reimburse` change a second transaction and keep no inverse.
- U6. `restore_transaction` derives no inverse of its own: V19 does not undo an undo.
- U7. `restore_transaction` is an internal tool (`tool.Spec.Internal`): the registry runs it as an inverse, and neither the chat nor MCP declares it. Measured on 2026-11-22: the declarations of the catalog add up to 99,989 bytes of the 100,000 of G12 (assistant parity design), and the declaration of this tool adds 732; a tool no model calls on its own does not enter every model call. `TestToolCatalogQuality` reads the declared tools, so its ceiling keeps measuring what G12 names.

## 4. Cross-cutting questions

- R1: No regional value.
- R2: Does not apply: no regional value.
- R3: The statuses of U2 are a closed universal set of the tool output.
- R4: Does not apply: no extension point.
- R5: No catalog key: the proposal card writes the tool through the existing keys of an action; `assistant.action.restore_transaction` is added in pt-BR and en.
- R6: Does not apply: no new number or date on screen.
- C1: Amounts are those of the stored version, integers of minor units.
- C2: Does not apply: no sum.
- C3: Does not apply: the restored postings keep their currencies.
- C4: The items of the preview go through the proposal card, as every preview.
- T1: The restored date is the date of the stored version.
- T2: Does not apply.
- B1: Does not apply: no table.
- B2: No operation. The tool is a write: the registry runs it for the roles `owner` and `write`, the roles that confirm and undo a proposal.
- B3: Does not apply: no setting.
- D1, D2: Do not apply: no table, no schema change.
- D3: A restore is a new version of the transaction with its reason; the version it replaces stays in the history.
- D4: The write runs only after the member confirms the proposal, or asks for the undo.
- D5: Does not apply.
- S1: No operation. `restore_transaction` is listed in `withoutOperation` of `internal/server/tools_test.go`: it composes `listTransactionVersions` and `correctTransaction`, which `get_transaction` and `change_transaction` cover.
- S2: The undo button of a proposal card exists on the phone; no layout changes.
- S3: The guide article of the assistant states that a categorization and a correction can be undone.
- S4: The tool is declared to no model (U7); the chat reaches it through the undo of a proposal.
- X1: Does not apply: no domain scenario. `internal/ledger` tests the restore and both inverses through the tool registry.
- X2: Does not apply.
