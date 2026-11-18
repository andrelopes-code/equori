# Help catalog: every process that needs help

- Status: accepted (owner delegated the curation, `docs/specs/2026-10-29-ui-clarity-design.md`, section 6, item 5)
- Builds on: `docs/specs/2026-11-17-help-design.md`, `docs/specs/2026-11-18-help-video-composed-design.md`, ADR 037.

The help holds 14 pages; five carry figures and four a video. This spec lists every process of the application, decides by the curation of `docs/specs/2026-10-29-ui-clarity-design.md` (section 5) which one gets a page, and fixes the existing pages whose text differs from the screen.

## 1. Sources of the inventory

- Every route of `web/src/navigation/navigation-map.json` (44 entries) and its tasks.
- The flows F1 to F9 of `docs/domain/03-domain-flows.md` and the scenario groups of `docs/domain/06-scenarios.md`.
- The actions each screen draws, read on the running application with the demo book (`make demo`), in pt-BR and en.
- The symptoms of `troubleshooting` and the empty states of the screens.
- The 30 topics of `internal/assistant/guide/articles/`.

## 2. Curation rules applied

A process gets a page when one criterion holds (curation 5.2, help spec HP1):

| Code | Criterion |
|---|---|
| K1 | A task of several steps whose order the screen does not show, or whose error costs work to undo. |
| K2 | A screen with a concept of its own that no label explains (curation 5.2, "Sobre esta tela"). |
| K3 | A task the curation listed for the documentation (curation, Camada 4) and not yet delivered. |

A process is rejected when one holds:

| Code | Reason |
|---|---|
| N1 | A list, a short form or a simple settings screen: its labels and descriptions answer it (curation 5.2). |
| N2 | An existing page covers it; the row names that page. |
| N3 | The process needs a language model provider: the text cannot be checked by an agent (CLAUDE.md forbids provider runs), and no figure can be recorded. |
| N4 | Every step after the first press is a write or needs data the demo book cannot hold (a bank connection, an instance administrator): no figure can be recorded; the guide article answers the assistant. |

## 3. Inventory

Columns: id; Diátaxis kind; screens; steps; demo data needed; figures; video; regional passage; guide article; priority (P1 first); decision.

| Id | Kind | Screens | Steps | Demo data | Fig. | Video | Region | Guide | Pri. | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| record-transaction | howto | `/transactions/new` | kind, amount, account, date, category, save | accounts, categories (present) | 5 | yes | no | transactions_and_postings | P1 | new page (K1: F1, S01 to S04) |
| installments | howto | `/cards/$accountId` | open the card, Installment purchase, total and count, category, record | a credit card (present) | 4 | yes | no | installments | P1 | new page (K3; F2, F3, S05 to S15) |
| text-capture | howto | `/transactions/capture` | Write as text, type lines, default account, read the drafts, record | accounts, cards, tags (present) | 4 | yes | no | capture | P1 | new page (K1: section 6.18) |
| correct-transaction | howto | `/transactions/$id`, `/transactions/$id/correct` | open, Correct, change, reason, save; Void | a manual transaction (present) | 5 | yes | no | transactions_and_postings | P1 | new page (K1: F1 versions; symptom `transaction-twice`) |
| reimbursement | howto | `/transactions/$id` | open the expense, Record reimbursement received, choose the receipt, amount, record | an expense and an unlinked income within 90 days | 3 | yes | no | refunds_reimbursements_and_disputes | P2 | new page (K2: F8, S18 to S20, S113, S114) |
| schedule | howto | `/planning/schedules/new`, `/planning` | kind, description, amount, account, category, recurrence, create | accounts, categories (present) | 5 | yes | no | schedules_and_occurrences | P1 | new page (K1: F7, S27 to S29, S143, S283 to S285) |
| create-budget | howto | `/planning/budgets/new` | category, monthly amount, first month, carry over, create | categories (present) | 4 | yes | no | budgets | P2 | new page (K1: section 6.16) |
| buy-investment | howto | `/transactions/new` | Other types, Investment buy or sale, operation, brokerage, investment, quantity and price, save | a brokerage with cash and an instrument (present) | 5 | yes | no | investment_operations | P2 | new page (K1: F9, S21, S22) |
| contribution-plan | reference | `/portfolio/contribution-plan` | what the plan shows, targets, locks, the contribution | a saved plan (present) | 3 | no | no | contribution_plan | P2 | new page (K2) |
| import-statement | howto | `/accounts/$id/import`, `/accounts/$id/imports/$batchId` | as today, with "Review a line" | a batch line that waits for review | +1 | yes | no | imports_and_bank_connections | P3 | revision: the review figure (section 6) |
| portfolio | reference | `/portfolio` | as today | present | 3 | no | yes (BR) | investments | P1 | revision: the neutral page names a regional index (section 5, D2) |
| budget-plan | reference | `/planning` | as today | present | 2 | no | no | budgets | P1 | revision: labels differ from the screen (section 5, D3) |
| check-balance | howto | `/accounts/$id` | as today | present | as today | yes | no | reconciliation | P1 | revision: labels written without their amount (section 5, D3) |
| statement | reference | `/cards/$accountId/statements/$statementId` | as today | present | 2 | no | no | credit_cards_and_statements | P3 | revision: figures |
| first-month | tutorial | `/start` to `/reports` | as today | present | 0 | no | no | getting_started | P2 | revision: links to the new pages |
| glossary | reference | none | | | 0 | no | no | getting_started | P2 | revision: terms the new pages introduce |
| pay-statement | howto | `/cards` | as today | present | as today | yes | no | credit_cards_and_statements | | kept: text and media checked against the catalog (section 5) |
| category-rule | howto | `/categories/rules/new` | as today | present | as today | yes | no | categorization_rules_and_payees | | kept |
| connect-bank | howto | `/settings`, `/accounts/links` | as today | none possible | as today | no | yes | imports_and_bank_connections | | kept; the linking steps stay without figure (N4) |
| installation | howto | none | | | 0 | no | no | getting_started | | kept (N4: the Backup panel needs an administrator) |
| troubleshooting | reference | many | | | 1 | no | yes | getting_started | | kept |
| how-money-is-recorded | explanation | none | | | 0 | no | no | transactions_and_postings | | kept |
| bank-connections | explanation | `/accounts/links` | | | 0 | no | yes | imports_and_bank_connections | | kept |
| overview | | `/` | | | | | | getting_started | | rejected N2 (first-month, stop 5) |
| first-use walkthrough | | `/start` | | | | | | getting_started | | rejected N2 (first-month, stop 1) |
| list and filter transactions | | `/transactions` | | | | | | transactions_and_postings | | rejected N1 |
| categorize several at once | | `/transactions` | | | | | | categorization_rules_and_payees | | rejected N1 (the selection bar names the action) |
| offline captures | | `/transactions/queue` | | | | | | capture | | rejected N1 |
| attach a receipt | | `/transactions/$id` | | | | | | transactions_and_postings | | rejected N1 (one button, S31) |
| mark as transfer | | `/transactions/$id` | | | | | | transfers | | rejected N2 (correct-transaction names it; S45 to S50 are imports) |
| category tree, merge | | `/categories` | | | | | | accounts_and_categories | | rejected N1 |
| rules list, suggested rules, aggregator map | | `/categories/rules` | | | | | | categorization_rules_and_payees | | rejected N2 (category-rule; S37 to S44, S72 to S79, S98) |
| payees, tags | | `/categories/payees`, `/categories/tags` | | | | | | categorization_rules_and_payees | | rejected N1 |
| cards list | | `/cards` | | | | | | credit_cards_and_statements | | rejected N2 (pay-statement, statement) |
| limits and billing cycle | | `/cards/$accountId` | | | | | | credit_cards_and_statements | | rejected N1 (a form with descriptions) |
| refund, dispute, early installments | | statement | | | | | | refunds_reimbursements_and_disputes | | rejected N2 (statement; S80 to S89) |
| balance sheet, open an account | | `/accounts`, `/accounts/new` | | | | | | accounts_and_categories | | rejected N2 (first-month, stop 1) |
| edit, close, reopen an account | | `/accounts/$id/edit` | | | | | | accounts_and_categories | | rejected N1 |
| institutions | | `/accounts/institutions` | | | | | | accounts_and_categories | | rejected N1 |
| bank connection sync | | `/accounts/links` | | | | | | imports_and_bank_connections | | rejected N4 (S51 to S59, S68 to S71, S90 to S97, S167 to S175) |
| goals | | `/goals` | | | | | | goals | | rejected N1 (a short form; the what-if values are labelled) |
| occurrences of a month | | `/planning` | | | | | | schedules_and_occurrences | | rejected N2 (schedule, section "After creating") |
| subscriptions | | `/planning` | | | | | | schedules_and_occurrences | | rejected N2 (schedule) |
| income split | | `/planning` | | | | | | income_split | | rejected N2 (budget-plan) |
| budget detail, delete | | `/planning/budgets/$id` | | | | | | budgets | | rejected N1 |
| instruments, prices import | | `/instruments`, `/instruments/$code` | | | | | | investments | | rejected N1 (the import states its rule on screen, S64 to S67, S119 to S130) |
| fixed income terms | | `/instruments/$code` | | | | | | fixed_income | | rejected N1 (regional products; the guide covers them, `docs/domain/br-product-coverage.md`) |
| tax year of investments | | `/portfolio/year` | | | | | | investments | | rejected N1 (a report; tax classes are regional) |
| reports | | `/reports` | | | | | | reports | | rejected N2 (first-month, stop 5; S145 to S157) |
| calculators | | `/calculators`, `/calculators/$id` | | | | | | investments | | rejected N1 (each states its formula) |
| language, region, privacy | | `/settings` | | | | | | settings_language_and_region | | rejected N1 |
| providers and limits of the model | | `/settings` | | | | | | privacy_and_the_assistant | | rejected N3 |
| appearance | | `/settings/appearance` | | | | | | settings_language_and_region | | rejected N1 |
| second factor, passkeys | | `/settings` | | | | | | getting_started | | rejected N4 (every step writes; symptom `second-factor` stays) |
| members and invitations | | `/settings` | | | | | | getting_started | | rejected N4 (the invitation is a write) |
| backup and restore | | `/settings` | | | | | | getting_started | | rejected N2 (installation) and N4 |
| foreign purchase, exchange | | `/transactions/new` | | | | | | foreign_purchases_and_exchange | | rejected N1 (one form, each field labelled; S16, S17) |
| investment income, brokerage note, corporate event, custody transfer | | `/transactions/new` | | | | | | investment_income, investment_operations | | rejected N1 (each kind's form describes itself; buy-investment shows the menu) |
| assistant conversation and proposals | | panel | | | | | | privacy_and_the_assistant | | rejected N3 (S131 to S142) |

Scenario groups without a screen of their own (6.1 fixture, 6.12 coverage, 6.19 daily flows, 6.21 cash view, 6.22 indicators) are read by the screens above.

## 4. Decisions

| ID | Decision |
|---|---|
| HC1 | Nine new pages: `record-transaction`, `installments`, `text-capture`, `correct-transaction`, `reimbursement`, `schedule`, `create-budget`, `buy-investment` (howto) and `contribution-plan` (reference). Each howto has a video; `contribution-plan` has figures only. |
| HC2 | Order of `helpPages`: the walkthrough, the howtos by area (transactions, cards, accounts, planning, portfolio, installation), the references, the explanations. Areas of the new pages: `record-transaction`, `text-capture`, `correct-transaction`, `reimbursement` in `transactions`; `installments` in `cards`; `schedule`, `create-budget` in `planning`; `buy-investment`, `contribution-plan` in `portfolio`. |
| HC3 | Each new page opens its screen from the header action (`screen` of `helpGuides`); each screen it describes draws `HelpLink` in its header: `/transactions/new` (`record-transaction`), `/transactions/capture` (`text-capture`), the card header (`installments`), `/transactions/$id/correct` (`correct-transaction`), `/planning/schedules/new` (`schedule`), `/planning/budgets/new` (`create-budget`), `/portfolio/contribution-plan` (`contribution-plan`). `reimbursement` and `buy-investment` share a screen with another page and draw no second link. |
| HC4 | A bold text of a page is a label of the interface or a term of the glossary of its language. `help-pages.test.ts` reads every bold text and accepts a catalog text (a placeholder `{x}` matches any words), a Slotted message or a glossary term. The existing texts that fail are rewritten (D3). |
| HC5 | A page is found by the words a reader types: `search-help.test.ts` holds, per new page and language, one query whose best result is that page. |
| HC6 | No subagent is dispatched: every slice records a tape from the one running instance and builds media on a machine with 7 GB free; two builds at once exceed it. The list sent to the owner is empty. |
| HC7 | Media is built with `HELP_MEDIA_JOBS=2` from the production build. When an uncommitted change of another session touches a captured screen, the build runs in a detached worktree in the scratchpad (task statement, "Build da mídia"). |

## 5. Defects found in the existing help

| ID | Defect | Fix |
|---|---|---|
| D1 | `internal/assistant/guide/articles/installments.md` says an installment purchase is recorded on New transaction; the form has no installment field. It is recorded from the card page (`card-header.tsx`, `card.installmentPurchase`) or by text capture (`capture.installments`). | The article names the two places (slice 2). |
| D2 | `portfolio.md` names the CDI in the neutral page (pt and en). The screen writes `return.against.index` with the region's index. | The neutral page says "against the index"; the BR passage names the CDI (slice 0). |
| D3 | Bold texts that are no label: `budget-plan` writes "falta distribuir" / "unassigned" where the screen says **A distribuir** / **To distribute**; `check-balance` and `troubleshooting` write **Registrar ajuste** / **Record adjustment** and **Record yield** where the screen says "Registrar ajuste de {amount}". | Rewritten to the screen's words; the guard of HC4 keeps them (slice 0). |

## 6. Claim sources

Each page has a table "claim → source" in section 9, written in its slice. A claim without a source is removed. A behavior is checked on the running application with the demo book.

## 7. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | No regional value enters a neutral page. The regional facts go to `content/regions/BR/<language>/<page>.md` (extension point "Help passages", `docs/contributing/regions.md`). `portfolio` gains a BR passage (D2). |
| R2 | A region without a passage reads the neutral page. |
| R3 | Does not apply: no value set. |
| R4 | Does not apply: the help passages already have their row in `regions.md`. |
| R5 | No catalog key is added: the pages are Markdown per language of `web/src/i18n/languages.ts` (pt, en); `HelpLink` uses its existing key. |
| R6 | Does not apply: the pages write no number or date of their own; the figures are captures. |
| C1 | Does not apply: no amount is stored or computed. |
| C2 | Does not apply. |
| C3 | Does not apply. |
| C4 | Does not apply: the amounts in a figure are pixels of the demo book. |
| T1 | Does not apply: the tape fixes the clock of the recording. |
| T2 | Does not apply. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply. |
| D2 | Does not apply. |
| D3 | Does not apply: a tutorial never confirms a write (ADR 037, 2). |
| D4 | Does not apply. |
| D5 | Does not apply. |
| S1 | Does not apply: no operation of `api/openapi.yaml`. |
| S2 | `/help/$page` is a phone route; the screens that gain `HelpLink` are desktop routes, except none. |
| S3 | Each slice updates the guide article of its screen's topic (the help page it can open) and `getting_started.md` (the pages with figures). |
| S4 | The assistant links help pages through the tasks of `/help/$page` in `navigation-map.json`; each slice adds its page id there. |
| X1 | Does not apply: no scenario is added. |
| X2 | Does not apply: R1 and R2 add no behavior; the test of the BR passage of `portfolio` reads region US and region BR. |

## 8. Tests

- `model/help-pages.test.ts`: every page in every language; the bold guard (HC4); no regional value in a neutral page; the BR passage of `portfolio`; the media of every page (figures and videos listed).
- `search/search-help.test.ts`: the query of each new page (HC5).
- `link/help-link.test.tsx` and the test of each screen that gains `HelpLink`: the link names its page.
- `tools/help-media`: `node --test` and `make help-media-check`.
- `go test ./internal/assistant/guide`: labels and terms of the articles.

## 9. Claim sources per page

### Slice 0: corrections

| Claim | Source |
|---|---|
| portfolio: the summary label reads "Proventos em {year}" / "Income in {year}" | `web/src/i18n/catalog-holdings.pt-BR.ts:16`, `catalog-holdings.en.ts:14`; screen `/portfolio`, demo book |
| portfolio: the comparison names the region's daily index | `web/src/features/portfolio/model/return-summary.ts:126`; `internal/portfolio/region_defaults.go:17` (`defaultBenchmark`) |
| portfolio BR: the index is the CDI, the inflation index the IPCA | `internal/portfolio/region_defaults.go:17-22`, `:39-44` |
| check-balance, troubleshooting: the buttons read "Registrar rendimento de {amount}", "Registrar ajuste de {amount}" | `web/src/i18n/catalog-accounts.pt-BR.ts:401-402`, `catalog-accounts.en.ts:404-405` |
| budget-plan: the bar reads "A distribuir" / "To distribute"; the column "Gasto em {month}" / "Spent in {month}" | `web/src/i18n/catalog-budget-plan.pt-BR.ts:8,45`, `catalog-budget-plan.en.ts:7,45` |
| import-statement: each similar transaction carries a "Pontuação" / "Score" | `web/src/i18n/catalog-accounts.pt-BR.ts:646`, `catalog-accounts.en.ts:648` |

### Finding: the module cache of Vitest

Vitest 5 keeps transformed modules in `node_modules/.vitest-cache` (`fsModuleCache`, default on), keyed by the module's source. A Markdown file added under `content/` is not seen by the cached `import.meta.glob` of `help-pages.ts`: the BR passage of `portfolio` was missing until the run passed `--experimental.fsModuleCache=false`. Decision: the flag is documented in `docs/contributing/help.md` for the first run after adding a page; the cache stays on for the other suites of the shared machine. CI starts without a cache and is not affected.

### Slice 1: record-transaction

| Claim | Source |
|---|---|
| The navigation button and the key N open the form used last, this one or the text entry | `web/src/app/shell/frame-state/use-entry.ts:11-21`, `:58-60` |
| Kind of transaction offers Expense, Income, Transfer and Other kinds | `catalog.pt-BR.ts:939-943`, `catalog.en.ts:929-933`; figure `entry-kind` |
| The account field reads Pay with, Receive in, From account and To account by kind | `transaction-form/simple-entry-fields.tsx:15-17`, `:87`; screen, demo book |
| The list of accounts holds "Leaves the balance now" and "Goes to the statement"; a card names its statement | `catalog.pt-BR.ts:1388,1390,1419`; aria tree of the sheet, demo book; figure `entry-sheet` |
| Save opens the list and shows "Transaction recorded" with View; Save and add another keeps kind, account and date | `new-entry/use-submit-entry.ts:52-82`, `new-entry/use-announce.tsx:13-25` |
| Other kinds opens the investment, foreign purchase and exchange forms; Write as text opens the text entry | menu of the screen, demo book; `new-entry/new-entry-header.tsx` |

### Slice 2: installments

| Claim | Source |
|---|---|
| The purchase is recorded on the card's page, with "Purchase in installments" | `features/cards/card-header/card-header.tsx` (`card.installmentPurchase`); figure `installments-open` |
| One installment per statement, from the purchase's statement on | `installments.hint`, `catalog-*.ts`; dialog, demo book |
| Price, Purchase date, Category, Installments, Interest (optional), Record purchase | `card-record/installment-purchase-dialog.tsx:107-205`; aria tree of the dialog, demo book |
| The dialog writes the approximate installment and the total | `installments.summary` ("{count} installments of about {each}, {total} in all"); figure `installments-count` |
| Interest is what is paid beyond the price, zero without interest | `installments.interestHint` |
| The tab Installment plans lists Purchase, Billed, Installment, Still to bill; a row button opens the plan | `plans-tab/plans-tab.tsx:172-179`, `:234` (`plans.openPlan`) |
| Cancel plan credits the installments not billed; the billed ones follow the bank | `plan.cancelHint` |
| Bring forward moves the remaining installments to one statement | `plan.anticipateHint` ("{count} remaining installments move to the statement of {month}") |
| Text capture takes "10x" on a line | `capture.hint` ("3x for installments"); screen `/transactions/capture`, demo book |

### Finding: the pointer of the video

The pointer of a video rested on the centre of the mark. A mark that surrounds two fields (the price and the date of `installments-price`; the date and the category of `entry-category`) put the click between them. Fixed in the tool: a beat declares `point`, the element its `act` uses; the timeline writes it and the compositor rests the pointer on it (`compose-frame.ts`, `lib/video.mjs`, `lib/capture.mjs`; tests in `compose-frame.test.ts` and `video.test.mjs`). `check` refuses a point outside its mark.

### Reorganization: the card header

`CardHeader` held 167 lines (limit 150) before the help link. Its menu moved to `card-header/card-menu.tsx` without a change of condition, text or order. Card tests: 76 before, 78 after (the help link and a new test of the menu). A defect injected in `card-menu.tsx` (closed inverted) failed no test before the new test of the menu; it fails that test now. Line counts: `card-header.tsx` 145, `card-menu.tsx` 112.

### Slice 3: text-capture

| Claim | Source |
|---|---|
| Each line becomes a draft; nothing is recorded until the confirmation | `capture.subheading`, `capture.empty`; screen, demo book |
| A line without an account uses the default account | `capture.defaultAccountHint` |
| A line holds amount, date (yesterday, friday, 12/10), account or card (final 1234), 3x, #tag | `capture.syntax`; `internal/capture/domain/lexicon_pt.go:13`, `lexicon_en.go:9,16` |
| Without a date, today counts | `internal/capture/domain/read_line.go:21` |
| The draft names the source of its category: by rule, by payee history, suggested by AI | `capture-drafts/capture-line-item.tsx:86-97`; `capture.source.*` |
| Edit replaces the reading until the text of the line changes | `capture.editDescription` |
| Record carries the count; Ctrl with Enter records | `capture.record`; `capture.composerHint` and the keys under the composer, figure `capture-text` |
| After recording, a notice gives the count and View opens the list | `capture-submit/use-capture-submit.tsx:67-81` |

The step "Edit" has no figure of its own: a mark around one draft or its button crossed the text of the neighbouring draft (the rows stand 6 px apart, the mark keeps 12 px). The figure of the drafts marks the list and the pointer of the video rests on Edit.

### Slice 4: correct-transaction

| Claim | Source |
|---|---|
| A double press opens the transaction in a panel beside the list | `transactions-grid/transactions-grid.tsx:249-252` (`activatable`); Slotted `data-grid.md:178`; `transactions-listing.tsx:89-100` |
| The panel's menu "Transaction actions" holds Correct, Mark as transfer, Record reimbursement received, Open as a page, Void | aria tree of the menu, demo book; figure `correct-choose` |
| The correction asks for a reason, kept in the history | `correct.reason`, `correct.reasonHint`, `correct.reasonRequired`; `correction/correction-form.tsx` (`send`) |
| Saving shows "Correction saved" and opens the transaction | `correction/correction-form.tsx` (`toast`, `navigate`) |
| A voided transaction stays in history and leaves balances and reports; reason up to 500 characters | `void.description`, `void.reasonHint` |
| The list hides voided transactions unless "Show voided" | `transactions.showVoided`; screen, demo book |

### Reorganization: the correction header

`CorrectionForm` (`correction-form.tsx`, 260 lines) and `CorrectionPage` drew the same header. It moved to `correction/correction-header.tsx`, which gains the help link. Correction tests: 28 before, 30 after (the help link and the date and version of the header). A defect injected in the header (version + 1) failed no test before the new test of the subtitle; it fails that test now. Line counts: `correction-form.tsx` 221, `correction-page.tsx` 79, `correction-header.tsx` 71. `CorrectionForm` holds 175 lines of component (203 before), above the limit of 150; the slice adds no code to it, and its send logic is the next split.

### Decision: the resting cursor of the grid

After the double press, the description cell of the list keeps a muted ring. It is the resting cursor of the Slotted grid (`--_cursor-rest`, 60 % alpha), drawn on purpose, not a focus ring: the stills show it as the reader sees it. Issue andrelopes-code/slotted#148, opened on the first reading, was corrected and closed.
