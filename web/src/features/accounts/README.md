# accounts

Accounts, balances, institutions, imports, bank connections and reconciliation.

## Routes

Defined in `web/src/app/router.tsx`, under the layout `accounts` (`accounts-header/accounts-layout.tsx`).

- `/accounts`: `AccountsPage`
- `/accounts/new`: `NewAccountPage`
- `/accounts/$id`: `AccountPage`
- `/accounts/$id/edit`: `EditAccountPage`
- `/accounts/$id/import`: `ImportPage`
- `/accounts/$id/imports/$batchId`: `BatchPage`
- `/accounts/institutions`: `InstitutionsPage`
- `/accounts/links`: `LinksPage`

## Guide topics

`accounts_and_categories` (list, new, record, edit, institutions), `reconciliation`, `investments`, `schedules_and_occurrences`, `reports` (record), `imports_and_bank_connections` (import, batch, links).

## Endpoints

`api.ts` calls `/accounts` (list, create, update, close, reopen, unlock, balance, projection, reconciliation, unconfirmed, balance-assertions, csv-profile, imports, appearance, parent), `/balances`, `/positions`, `/connections` (list, delete, sync, syncs, account mapping), `/institutions` (delete, identifier), `/institution-identifier-schemes`, `/import-batches` (list, get, records), `/external-records` (resolve, reopen, undo) and `/balance-assertions/{id}/resolve`.

## Folders

- `pages/`: components that a route renders, with their tests and the search validation of `/accounts`
- `model/`: pure functions used by several folders (kinds, drafts, search, routes, shapes, institution logos, trees)
- `accounts-header/`: layout and header slots of the `/accounts` routes
- `balance-sheet/`: grouped balances table and totals of the list
- `account-card/`: account card, its meter and its preview
- `account-mark/`: account mark, avatar, link and row status
- `account-record/`: header, tabs and tab panel of the account page
- `account-dialogs/`: close, reopen and unlock dialogs
- `account-ledger/`: ledger list and running balance
- `balance-chart/`: balance series chart
- `reconciliation/`: balance assertions and unconfirmed records
- `positions/`: positions tab
- `scheduled/`: scheduled tab
- `imports-tab/`: imports tab and count tags
- `sync/`: sync tab, source card, start and stop dialogs
- `connections/`: connection cards, sync history and state alerts
- `links/`: link drawer and link candidates
- `batch/`: import batch records, filters and subtitle
- `review/`: review workspace, queue, selection and discard dialog
- `candidates/`: match candidates and their scores
- `transfer-candidates/`: transfer candidates
- `institutions/`: institution field, catalogue and dialogs
- `account-form/`: create and edit form sections
- `card-setup/`: card and billing rule fields
- `csv/`: CSV profile fields, guess and preview
- `import/`: import form fields, file reading and draft
