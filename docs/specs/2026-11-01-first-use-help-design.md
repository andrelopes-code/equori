# First use and help (amendments A173 to A177)

Phase P15 of `docs/domain/09-roadmap.md`, section 9.4.2. Amends Camada 3 and Camada 4 of `docs/specs/2026-10-29-ui-clarity-design.md`. Scenarios S241 to S252.

## Goal

Exit criterion of P15, quoted: "P16 testers record their first transactions without outside help."

Scope of P15: a first-use walkthrough; help pages for installation, bank connection and troubleshooting in both languages; in-app notices for due statements and budgets.

Outside help is any instruction not shown by equori itself: a person, a guide outside the app, a typed address. P15 reads `delivered` when S251 and S252 pass. P16 repeats the check with its testers, as its scope states ("check of every exit criterion of P10 to P15"). Reason: the phase closes on checks the agents run; the testers of P16 confirm it on real accounts.

Input: the owner's competitive study of 2026-10-30 (`docs/domain/09-roadmap.md`, section 9.4). Its item "Roteiro de primeiro uso" reads: "Um passo a passo no primeiro acesso que pergunta quais bancos e cartões a pessoa usa e cria tudo sozinho, em vez de deixar uma tela vazia." Its example: three screens, the institutions marked, the closing days of the cards given, the accounts ready for entries.

## Current state

Read on 2026-11-01 at `4371e1a1`.

| Topic | State | Source |
|---|---|---|
| After setup | `useSetupSubmit` navigates to `/`. The overview of a new book shows the block "Primeiros passos". | `web/src/features/session/use-setup-submit.ts` |
| First steps | Three steps: account (`/accounts/new`), transactions (`/transactions/new`), categories (`/transactions?uncategorized=true`). The block leaves when the three are done or when the reader dismisses it; the dismissal is kept in `localStorage`. | `web/src/features/overview/first-steps.ts`, `first-steps-block.tsx`, `use-first-steps-dismissal.ts` |
| Account creation | One account per form. `createAccountSteps(draft, { openingBalances })` runs the steps after `createAccount`: the opening balance and, for a card, the billing cycle rule and the cards. A failed step writes `writePendingSetup`, and the account page offers the remaining steps. | `web/src/features/accounts/new-account-screen.tsx`, `create-account-steps.ts`, `account-draft.ts` |
| Institutions | `InstitutionField` chooses an institution of the book or creates one from the catalogue of the region. | `web/src/features/accounts/institution-field.tsx`, `institution-catalogue.ts` |
| Help pages | 11 pages in `en` and `pt`; the BR passage of `bank-connections`. No page on installation, on connecting a bank step by step, or on troubleshooting. | `web/src/features/help/help-pages.ts`, `docs/contributing/help.md` |
| Attention block | Items `uncategorized`, `unconfirmed`, `connections` (every state other than `ok`, A150, A151), `difference`. | `web/src/features/overview/attention.ts` |
| Statements on the overview | The block of cards lists the open statement and every unpaid closed statement of the last 12 months, with amount and due date, ordered by due date. No item marks a due date as near or past. | `web/src/features/overview/cards-block.tsx`, `open-statements.ts` |
| Budgets on the overview | The block of budgets lists the budgets in state `over` or `near` (`budgetState`). | `web/src/features/overview/budgets-block.tsx`, `budget-alerts.ts`, `web/src/features/planning/budget-month.ts` |
| Browser tests | Vitest with `renderApp` and `fakeApi`. No browser runner in `web/package.json`. | `web/src/testing/` |

## A173 First-use walkthrough

1. Route `/start`, inside the application frame, with three steps in a `Stepper`: "Where your money is", "Details", "How entries arrive". Each step has "Back" (absent on the first step), the step's main action, and "Not now", which navigates to `/`. Reason: three screens, as the owner's study sets.
2. Step 1 holds a list of rows, at most 10. A row is one institution, chosen with `InstitutionField`, and the kinds to create for it: `checking`, `savings`, `credit_card`, at least one per row. Below the list, a check box adds one `cash` account, with no institution. The main action "Continue" requires one row or the check box. Reason: an institution holds a checking account and a card in most cases; the row asks the institution once.
3. Step 2 holds one group per account to create, in row order, then `cash`. Each group holds the name, prefilled with the institution's name followed by the kind's label (`kind.<kind>` of the catalog), and the opening amount. A `credit_card` group adds the closing day, the due day and the limit. The fields, their validation and their texts are those of the account form for the same kind. The currency is the base currency of the book; `opened_on` is today of the book. Reason: one validation for an account, whether the form or the walkthrough creates it.
4. The main action of step 2, "Create accounts", creates the accounts one at a time, in group order, through `createAccount` and then `createAccountSteps`. A group whose account was created shows "Created" and leaves its fields read-only. A failed `createAccount` stops the run; its group shows the problem text and its field errors; the main action then retries from that group. A failed later step behaves as in the account form: `writePendingSetup`, and the group shows "Created" with the line of the pending setup. Reason: a retry never creates an account twice.
5. Step 3 lists the created accounts and three actions: "Connect a bank" (`/accounts/links`), "Import a file" (`/accounts/$id/import` of the first account created whose kind imports a file), "Record a transaction" (`/transactions/new`). The last is the main action. A link to the help page `connect-bank` follows the list.
6. The walkthrough keeps its state in memory only. A reload starts it again at step 1; the accounts already created stay and show in the institution field. Reason: the state lasts minutes, and the account form's draft storage serves one account.
7. `/start` opens for every member and every book. A member with role `read` gets the 403 problem of `createAccount` in the group, as on the account form. Reason: the web does not gate screens by role today; a gate for one screen would differ from every other screen.
8. Texts in both catalogs, `catalog.en.ts` and `catalog.pt-BR.ts`. `/start` is desktop-only (ADR 027, S2): on the phone it shows the notice of ADR 027, S4. Reason: the installation script opens setup on the computer (A163.11), and the account sections the walkthrough reuses belong to `/accounts/new`, a desktop-only route.

## A174 Entry points

1. `useSetupSubmit` navigates to `/start` after a completed setup. An accepted invitation keeps its destination. Reason: the invited member joins a book that already holds accounts.
2. The step `account` of `firstSteps` takes the destination `/start`. The other two steps keep theirs.
3. The tutorial `first-month` names the walkthrough as its first step, in both languages.
4. `web/src/navigation/navigation-map.json` lists `/start` with its tasks, so the assistant can link it.
5. Camada 3 of the ui-clarity design gains: "The walkthrough `/start` opens once by itself, after setup. It is a creation screen, not a tour: it overlays no screen, and 'Not now' leaves it." Reason: the line of Camada 3 "nunca abre sozinho" addresses tours over a screen.

## A175 Help pages

Three pages, each in `en` and `pt`, added under `docs/contributing/help.md`, "Adding a page".

| Id | Kind | Content |
|---|---|---|
| `installation` | `howto` | The directory of the installation and its `.env`; why a copy of `.env` lives apart from the backups (the secret key, ADR 008, K2); upgrade (the same pasted command); start and stop (`docker compose start`, `docker compose stop` in the directory); where the backups and the copies are; removal with and without data (`docker compose down`, `docker compose down -v`); a link to the guide of each system for a new installation |
| `connect-bank` | `howto` | The steps on the screen **Links**: choose the aggregator, give its credentials, choose the accounts, link each one to an account of equori; what the sync summary shows; what to do when a connection reads stalled or its consent expires |
| `troubleshooting` | `reference` | One entry per symptom: the symptom in the words of the screen, its cause, the steps that correct it, and the screen or page that holds them |

1. The guides are linked as `https://github.com/andrelopes-code/equori/blob/main/docs/install/<system>.md`, and `<system>.pt-BR.md` from the `pt` page. Reason: the upgrade command installs the latest release, and the guides on `main` describe it.
2. The entries of `troubleshooting`, at least: a stalled connection; a consent that expires; a balance that differs from the institution's; a statement whose amount differs; an entry that appears twice; an entry that does not appear; a login refused after a lost second factor (the recovery codes); a late backup or copy; equori does not open in the browser (the troubleshooting section of the guide). Each entry has its own level-two heading, so a link can point at it.
3. `connect-bank` and `troubleshooting` are neutral pages. The BR passage of each, in `content/regions/BR/<language>/`, names Meu Pluggy, its free use of up to 5 connections of one holder (section 9.4.1, Aggregator) and the file import as the fallback.
4. The screen **Links** draws `HelpLink` with `connect-bank` in its header actions, in place of `bank-connections`. The page `connect-bank` links `bank-connections` for the idea behind the screens.
5. Each id is added to the tasks of `/help/$page` in `navigation-map.json`.

## A176 Notices for due statements and budgets

Two kinds join the attention block of the overview, after `connections`: `statement_due` and `budget_over`. Reason: the stalled connection of P12 is a notice of the same block; section 9.4.1, Notices, keeps every notice inside equori.

1. `statement_due`: one item per closed statement of an open card with `unpaid` above zero and `due_date` at most 3 days after today of the book. The line reads "Due on <date>", or "Overdue since <date>" when `due_date` is before today. The item opens the statement page, `/cards/$accountId/statements/$statementId`. Reason: 3 days covers a weekend and one working day for a payment to clear.
2. `budget_over`: one item that counts the budgets of the current month in state `over`. The item opens `/planning`. A budget in state `near` gives no notice; the block of budgets shows it. Reason: a notice asks for an action now, and `near` asks for none.
3. `attentionItems` takes the statements and the budget rows as inputs, as it takes the connections. The attention block reads them through `statementsQuery` with the 12 months of the block of cards and through the budget query of the block of budgets, so the overview shares one cache entry per read.
4. The days of A176.1 are a constant of `attention.ts` with its test.

## A177 Check of the exit criterion

1. S251 is a Vitest test through `renderApp` and `fakeApi`. It starts at `/start` on an empty book and ends with a `createTransaction` request. It acts only by `getByRole` with the accessible name the catalog gives, or by `getByLabelText`; it never calls `navigate` and never renders a route by path after the first. Reason: an action the screen does not name cannot be found by a reader without outside help.
2. S252 is the review step of the plan. The planning model runs a disposable Playwright script from the session's scratchpad against a fresh installation made by `install.sh` with the image of the working tree, at 1280 pixels wide, and at 390 pixels for the notice of A173.8. The script opens the setup URL printed by the installation and completes setup. It then follows only visible text to a recorded transaction, and saves at most four screenshots. Its outcome goes in the plan's Review. The script does not enter the repository. Reason: the repository has no browser runner, and a new dependency needs an ADR (`CONTRIBUTING.md`, Code).

## Regions

The walkthrough creates the kinds `checking`, `savings`, `credit_card` and `cash`; the kinds do not depend on region. The institutions come from the catalogue of the region (`institution-catalogue.ts`). The days of A176.1 do not depend on region. Meu Pluggy appears only in the BR passages of A175.3 (`docs/contributing/regions.md`, "Help passages"). No new extension point.

## Contract

No change to `api/openapi.yaml` or to the schema. The walkthrough calls `createAccount`, `createAccountSteps` and `listInstitutions` as they exist.

Files: `web/src/features/start/` (route, steps, the pure function that turns step 1 into account drafts, its test); `web/src/features/overview/attention.ts` and `attention-block.tsx`; `web/src/features/help/content/{en,pt}/{installation,connect-bank,troubleshooting}.md`; `web/src/features/help/content/regions/BR/{en,pt}/{connect-bank,troubleshooting}.md`; `help-pages.ts`; `navigation-map.json`; both catalogs.

Documents: `docs/specs/2026-10-29-ui-clarity-design.md`, Camada 3 (A174.5); `docs/domain/06-scenarios.md` gains the pointer section `### S241–S252 First use and help (A173–A177)`.

## Scenarios

| ID | Scenario | Expected |
|---|---|---|
| S241 | Setup completed | The router is at `/start`, step 1 |
| S242 | An accepted invitation | The destination of the invitation, not `/start` |
| S243 | Step 1 with no row and the check box clear | "Continue" is disabled |
| S244 | Step 1: one institution with `checking` and `credit_card`, and `cash`; step 2: opening 1000.00 on `checking`, closing day 3 and due day 10 on the card | Three `createAccount` requests in order `checking`, `credit_card`, `cash`; the opening balance of 1000.00; one billing cycle rule with `closing_day` 3 and `due_day` 10; step 3 lists the three accounts |
| S245 | S244 with the second `createAccount` answering 422 | The first group shows "Created"; the second shows the field error; a retry sends two `createAccount` requests, for `credit_card` and `cash` |
| S246 | "Not now" on any step | The router is at `/`; the step `account` of the first steps opens `/start` |
| S247 | Today 2026-11-10; closed statements with `unpaid` 500.00 and due dates 2026-11-13, 2026-11-14, 2026-11-09; one with `unpaid` 0 due 2026-11-11 | Two `statement_due` items: 2026-11-13 "Due on", 2026-11-09 "Overdue since"; none for 2026-11-14 and for the paid one |
| S248 | Budgets of the month: one `over`, one `near`, one `within` | One `budget_over` item with count 1, opening `/planning` |
| S249 | The help index in `en` and in `pt` | `installation` and `connect-bank` under how-to, `troubleshooting` under reference; `help-pages.test.ts` passes for the three ids |
| S250 | `connect-bank` with region `BR`, then with region `US` | The BR passage follows the page; then the page alone, with no name of a regional system |
| S251 | Exit criterion: the unaided walk of A177.1 | A `createTransaction` request is sent, with no `navigate` call in the test |
| S252 | Exit criterion: the browser walk of A177.2 | At 1280: a transaction recorded (`createTransaction` 201). At 390: setup completes and `/start` shows the notice of ADR 027, S4. Outcome in the plan's Review |

## Out of scope

- Push, e-mail or any notice outside equori (section 9.4.1, Notices).
- A notice for a budget in state `near`, or for a statement still open.
- An import of the history of another finance application (a separate item of the owner's study).
- A guided set-up of remote access from the phone.
- A gate of screens by role.
- A tour over a screen.

## Left to the plan

- The texts of the walkthrough and of the two notices in both languages.
- The text of the three pages and their BR passages, written after reading the screens they name.
- The component split of `/start` under the size limits of `web/CLAUDE.md`.
- The name of the budget query shared with the block of budgets.
