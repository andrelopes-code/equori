# transactions

Transaction list, entry forms, text capture, offline capture queue, detail, correction, reimbursement and attachments.

## Routes

Defined in `web/src/app/router.tsx`; every component is in `pages/`.

- `/transactions`: `TransactionsPage`; `/transactions/new`: `NewTransactionPage`
- `/transactions/capture`: `CapturePage`; `/transactions/queue`: `CaptureQueuePage`
- `/transactions/$id`: `TransactionPage`; `/transactions/$id/correct`: `CorrectTransactionPage`
- `/offline`: `OfflinePage`

## Guide topics

`transactions_and_postings`, `transfers`, `categorization_rules_and_payees`, `installments`, `foreign_purchases_and_exchange`, `capture`, `refunds_reimbursements_and_disputes` (`web/src/navigation/navigation-map.json`).

## Endpoints

`api.ts` calls `/transactions` and its sub-paths (`versions`, `attachments`, `categorization`, `categorize`, `transfer`, `void`, `reimbursement`, `reimbursement-candidates`, `reimbursement-sources`), `/transaction-batches`, `/categorizations`, `/capture/preview`, `/capture/suggestions`, `/trades`, `/investment-income`, `/foreign-purchases`, `/exchanges`, `/tags`, `/rules/{id}`, `/attachments/{id}`, `/investment-income-types` and `/accounts/{id}/statement-placement`.

## Folders

- `pages/`: components that a route renders
- `model/`, `entry-model/`, `capture-model/`: pure functions used by several folders (list and totals, entry forms, capture)
- `transactions-grid/`, `transactions-header/`, `transaction-filters/`, `selection/`: list, header, filters and bulk actions
- `transaction-detail/`, `transaction-facts/`, `attachments/`, `category-section/`: detail page parts
- `transaction-dialogs/`, `reimbursement/`: void, transfer, reimbursement and repayment dialogs
- `transaction-form/`, `account-field/`, `entry-kind-picker/`, `entry-result/`: shared form fields
- `exchange-entry/`, `foreign-entry/`, `income-entry/`, `trade-entry/`, `brokerage-account/`: entry forms by kind
- `correction/`: correction form and conflict view
- `capture-writer/`, `capture-drafts/`, `capture-submit/`, `capture-header/`: text capture screen
- `offline-queue/`: queued captures list and notice
