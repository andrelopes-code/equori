# accounts

Accounts, balances, institutions, imports, bank connections and reconciliation.

## Routes

Defined in `web/src/app/router.tsx`, under the layout `accounts-header/accounts-layout.tsx`.

- `/accounts`: `AccountsPage`; `/accounts/new`: `NewAccountPage`
- `/accounts/$id`: `AccountPage`; `/accounts/$id/edit`: `EditAccountPage`
- `/accounts/$id/import`: `ImportPage`; `/accounts/$id/imports/$batchId`: `BatchPage`
- `/accounts/institutions`: `InstitutionsPage`; `/accounts/links`: `LinksPage`

## Guide topics

`accounts_and_categories`, `reconciliation`, `investments`, `schedules_and_occurrences`, `reports`, `imports_and_bank_connections` (`web/src/navigation/navigation-map.json`).

## Endpoints

`api.ts` calls `/accounts` and its sub-paths, `/balances`, `/positions`, `/connections`, `/institutions`, `/institution-identifier-schemes`, `/import-batches`, `/external-records` and `/balance-assertions/{id}/resolve`.

## Folders

- `pages/`: components that a route renders, with the search validation of `/accounts`
- `model/`: pure functions used by several folders
- `accounts-header/`: layout and header slots
- `balance-sheet/`: grouped balances of the list
- `account-card/`, `account-mark/`: card, mark, avatar, link, row status
- `account-record/`: header, tabs and panel of the account page
- `account-dialogs/`: close, reopen and unlock dialogs
- `account-ledger/`, `balance-chart/`: ledger and balance chart
- `reconciliation/`, `positions/`, `scheduled/`, `imports-tab/`: account page tabs
- `sync/`, `connections/`, `links/`: bank connection sync, cards and links
- `batch/`, `review/`, `candidates/`, `transfer-candidates/`: import batch and review
- `institutions/`: institution field, catalogue and dialogs
- `account-form/`, `card-setup/`: create and edit form
- `csv/`, `import/`: CSV profile and import form
