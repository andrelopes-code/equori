# cards

Credit cards, their statements, installment plans and plastic cards.

## Routes (web/src/app/router.tsx)

- `/cards`: `CardsPage`
- `/cards/$accountId`: `CardPage` (search: `validateCardSearch`)
- `/cards/$accountId/statements/$statementId`: `StatementPage` (search: `validateStatementSearch`)
- `/preview/card-face`: `CardFacePreview` (development only)

Guide topics (navigation-map.json): `credit_cards_and_statements`, `installments`, `refunds_reimbursements_and_disputes`.

## Endpoints (api.ts)

- Cards: `PATCH|DELETE /cards/{id}`, `GET|POST /accounts/{id}/cards`
- Statements: `GET /statements/{id}`, `GET /statements/{id}/analytics`, `GET /accounts/{id}/statements`, `GET /accounts/{id}/statement-analytics`
- Statement actions: `POST /statements/{id}/defer|financing|payments|reconcile`, `PUT|DELETE /statements/{id}/facts`
- Settings: `GET|POST /accounts/{id}/credit-limits`, `GET|POST /accounts/{id}/billing-cycle-rules`
- Plans: `GET /installment-plans/{id}`, `POST /installment-plans/{id}/anticipation|cancellation`, `POST /installment-purchases`
- Charges: `GET|POST /transactions/{id}/disputes`, `POST /disputes/{id}/resolve`, `POST /transactions/{id}/refunds`
- Other: `GET /accounts/{id}`, `GET /accounts/{id}/commitments`, `GET /reports/flows`

## Folders

- `pages/`: route components, their tests and the statement search validator
- `card-tile/`: tile of one card in the list, with its statement stub, due date and week outflows
- `cards-figures/`: figures of the card list and the statements query of the list
- `card-record/`: body of one card, its tab panel, tab state, commitments and installment purchase dialog
- `card-header/`: header of one card and its tabs
- `card-settings-tab/`: settings tab with billing cycle and credit limit sections and dialogs
- `plans-tab/`: installment plans tab, plan drawer, plan words and plan rules
- `plastic-cards-tab/`: plastic cards tab with its add and delete dialogs
- `statements-tab/`: statements tab, statements chart and statement amount
- `analysis-view/`: analysis view shared by the card and the statement
- `statement-header/`: header of one statement and its step
- `statement-figures/`: figures of one statement, awaiting figure, difference proposal, unconfirmed notice
- `statement-lines/`: lines of one statement, line amount and dispute tag
- `statement-dialogs/`: statement dialogs: facts, finance, pay, reconcile
- `charge-actions/`: actions on one charge, with refund, dispute and plan dialogs
- `model/`: pure functions used by two or more folders (card search, totals, math, reference months, statement words, statement groups)
