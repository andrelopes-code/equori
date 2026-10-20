# Web Transactions and Categorization Implementation Plan

> **For agentic workers:** execute task by task in the main session (superpowers:executing-plans), in slices of at most three tasks with a checkpoint in `.claude/progress/current.md`. Every screen task follows the `compose-screen` skill; every region filled by a request follows `waiting-states`; every own element follows `build-own-element`. Each screen task ends with the `review-screen` skill over the changed screen.

**Goal:** Replace the placeholder pages of Transactions with working screens, and add a Categories destination that holds the category tree, the categorization rules and the payees. Every operation of the ledger and classification APIs that a person performs by hand is reachable from these screens.

**Architecture:** Feature `transactions` owns the list, the detail, the entry and correction forms and the category picker used by both features. A new feature `categories` owns the category tree, the rules and the payees. Both read the API through their `api.ts` (O3). URL search parameters hold every filter and selection, so a link reproduces the screen.

**Tech stack:** React 19, TanStack Router 1.170, TanStack Query 5, `@slotted/react` 0.1.0-beta.7, Vitest + Testing Library + jsdom. No new dependency.

**Decision source:** the owner delegated every UX decision on 2026-10-20 ("full freedom, including the sidebar"). The decisions below are the implementer's.

---

## 1. Information architecture

| Destination | Route | Desktop column | Phone |
|---|---|---|---|
| Transactions | `/transactions` | after Overview, uncategorized count badge | bar |
| Categories | `/categories`, `/categories/rules`, `/categories/payees` | after Transactions | More sheet |

- `/categories` header tabs: Categories, Rules (pending-suggestion count), Payees (LA-04). Each tab is its own route.
- Rule editor: `/categories/rules/new` and `/categories/rules/$id` (FM-01).
- Transaction detail: `/transactions/$id` (phone and deep links); on desktop at 1024 px and above the list opens the same content in a side panel driven by `?selected=<id>`, and the panel's "open full page" control leads to `/transactions/$id`.
- Command palette: adds "Categories", "Rules", "Payees", "Uncategorized transactions", "Run rules", "New rule".

## 2. Transactions list (`/transactions`)

- Page `bleed` + `fill` (CP-07, LP-12). Header: title, actions "New transaction" (key `N`, existing entry) and Refresh (AF-07). Header tabs: "All" and "Uncategorized (n)"; the second tab is `?uncategorized=true`, the queue of LP-09.
- `filter-bar` first in the body (LP-02): search field bound to `q` (debounced 250 ms, CP-09 deferred), pills Account, Category, Period, Payee, Tag. Account and Category both write `account_id` (the API holds one); adding one replaces the other, and the pill shown follows the class of the account. Period offers presets: this month, last month, last 30 days, this year, custom range. Count: rows loaded, with "+" when a next cursor exists (no count endpoint).
- `data-grid` (LP-14) over `useInfiniteQuery` with the cursor; the next page loads when the window reaches the last 20 rows. Columns: Date (`formatDayMonth`), Description (row header: payee name, else description; second line the description when a payee exists), Category (category mark + path; "Uncategorized" in warning tone as a button), Account (transfers read "from → to"), Tags (`tag` `sm`), Amount (numeric, sign colour from tone tokens, `formatMoney` by instrument scale, O7). Voided rows: struck amount and a `badge` `sm` "Voided". Phone: row header, amount, category keep their place; date, account, tags move to the pop-in (LP-01).
- Row activation (click, Enter) selects the row: desktop opens the detail panel (`?selected=`), phone navigates to `/transactions/$id`.
- Selection `multiple`; `action-bar` in the page footer (LP-03): count, Clear, "Categorize as…" (category picker), confirming action at the end. Bulk calls `POST /transactions/categorize` in chunks of 200 and reports categorized and refused counts with one line per refusal reason (FM-10).
- Inline categorization: the Category cell opens the category picker in a popover; choosing calls `POST /transactions/{id}/categorize` with one part holding the category total. A toast confirms with Undo (re-categorizes to the previous parts with the new version). When other uncategorized transactions share the payee (or the description, without a payee), the toast offers "Apply to n similar" (bulk categorize) and "Create rule" (opens the rule editor prefilled with `payee equals` or `description contains` and `set_category`).
- Keyboard on the grid: `C` opens the picker for the focused row, or for the selection; `/` focuses search; `Escape` clears the selection, then closes the panel.
- Uncategorized tab: pending rule suggestions appear in an `inline-message` above the grid ("n rule suggestions from your corrections") leading to `/categories/rules`. Empty state: "Everything is categorized" with the categorization statistics of the month.

## 3. Category picker (shared)

- Popover with a search field and a list of categories as paths ("Food › Groceries"), each with its category mark. Expense categories first for a negative amount, income first for a positive one; the class not matching follows under its own heading. Recent choices (last 5, kept per browser in `localStorage`, wrapped in try/catch) head the list. Archived categories (`closed_on`) and system accounts are not offered. Arrow keys, Enter, type-to-filter on the accent-insensitive path. "Create category "x"" at the end when the search matches nothing; it creates under the class of the list and selects it.
- Category mark: an own element: the category icon (Lucide geometry copied into `category-icon.tsx`, ISC licence, the curated `CategoryIcon` set) on a disc painted with `--slotted-data-<color>` at a soft mix; no icon draws the first letter; no colour uses the neutral token.

## 4. Transaction detail (panel and `/transactions/$id`)

- Header: title (payee or description), amount as the figure, date, `tag`s for origin (manual, import, schedule, system), Voided and Pending. Actions: Correct (→ `/transactions/$id/correct`), Void (dialog with required reason), Mark as transfer (dialog with an asset/liability account picker, `POST /transactions/{id}/transfer`; `pairing_ambiguous` lists the candidates to choose), Open full page (panel only).
- Sections: Category (current parts; edit in place with split: rows of category + amount, remainder shown live, total must equal the category total; `POST /transactions/{id}/categorize`); How it was categorized (`GET /transactions/{id}/categorization`: method in words, rule name linking to the rule, decided at); Postings (`table`: account, amount, status, settled on, memo, statement); Details (`description-list`: date, payee, description, tags, origin, version); Links (outbound and `referenced_by`, each leading to the linked transaction); Attachments (list, upload, download, remove); History (`timeline` of versions with reason and time).
- Errors: 404 → `result-state` `not-found`; transport → `error` with Try again (RP-04). 409 `version_conflict` re-reads and says so (ER-01, ER-02).

## 5. Entry and correction forms

- `/transactions/new` and `/transactions/$id/correct`, page `content` (CP-07), header `back` to the list or the record (FM-01).
- Kind segmented control: Expense, Income, Transfer, Advanced. Expense and income: amount (`currency-field`), date (`date-picker`, FM-16), account (asset/liability), category (picker, split allowed), payee (combobox with "Create "x"" through `POST /payees`), description, tags (`tags-input` with suggestions from `/tags`), memo. Transfer: amount, date, from account, to account, description. Advanced: postings editor (account, amount, memo; add/remove rows; live imbalance per currency; submit disabled with the reason while unbalanced).
- Error map keyed by the request field names (FM-02, FM-03), from `Problem.errors`.
- New: the draft lives in `sessionStorage` until submit or discard (FM-05); after submit the toast offers "View" and the form resets for the next entry, keeping date and account.
- Correct: prefilled from the transaction; reason required; sends `expected_version`; 409 re-reads, lists the fields that moved, keeps the draft and offers "Overwrite" or "Start from current" (FM-08). Kind is inferred from the postings; a transaction outside the three simple shapes opens in Advanced.

## 6. Categories (`/categories`)

- Page `wide`. Tab Categories: segmented control Expense / Income; period picker (month, default current month; `GET /reports/categories`); tree table (bounded set, `table` with indented rows or the `tree` family, whichever the docs show holds columns): mark, name, own total, subtree total, share of the class total as a bar; archived categories hidden behind a "Show archived" switch. Row menu: View transactions (`/transactions?account_id=`), Rename, Move (parent picker; A73 cycle error under the field), Appearance (8 data colours, icon grid of the curated set), Merge into… (confirm dialog that states the count of moved transactions when known), Archive / Reopen (`system_account` refusal stated). Header action: New category (dialog: name, class, parent, appearance).
- Tab Rules: figures from `/categorization-statistics` for the current month (share categorized automatically, by method); pending suggestions as cards (conditions and action read as a sentence, examples, Accept with a name, Dismiss); rule list in priority order with enable switch, sentence (`rule-text.ts` reused from admin through a move into `categories`), usage count and last use; reorder by drag grip and by menu (Move up, Move down, Move to top); header actions New rule and Run rules (result toast "examined n, categorized m"). Section "Bank categories" maps `/source-categories` to categories through the picker.
- Rule editor: name; conditions (field, operator, value typed by field: text, amount, account, weekday, day of month; between takes two values; in_list takes tags-input); actions (set category, set payee, add tags, split by percent/amount/remainder, transfer to account, mark reimbursable); stop processing; enabled. Read-back sentence above the form (BD-01). Live preview beside the form at 1024 px and above, under it below (`POST /rules/preview`, debounced 400 ms): counts of would-categorize and conflicts with up to 50 transactions each, as rows that open the transaction. Delete in the header menu with confirmation. Prefill from search parameters (`payee`, `description`, `category`) for "Create rule" from the list.
- Tab Payees: `data-grid` of payees with search; rename in place (`PATCH /payees/{id}`); select two or more → Merge into (choose destination among them); row panel: aliases of the payee (pattern, match type) with add, edit, delete; View transactions (`/transactions?payee_id=`).

## 7. Global constraints

- `web/CLAUDE.md` rules O1–O8 and the Slotted feedback protocol: findings are reported in the final reply under `Slotted findings`.
- Every user-visible string in `catalog.en.ts` and `catalog.pt-BR.ts`.
- Money as integer plus instrument code; formatting by instrument scale (O7).
- Mutations invalidate through `transactionMutated` and the new `categoryMutated` (accounts, reports, transactions).
- Tests through `renderApp` with `fakeApi`; assert visible text and the requests sent (method, path, body). No mock of internal hooks.
- Breakpoints: 600 px and 1024 px; touch target tokens under `pointer: coarse`.

---

## Tasks

Each task: write the failing tests first (run them, read the failure), implement, run `pnpm vitest run <changed dirs>`, `pnpm typecheck`, `pnpm lint`, then `make check-commit`, then commit one vertical slice.

### Task 1: Category foundation
Files: `features/transactions/category-icon.tsx`, `category-mark.tsx` (+ css), `category-paths.ts` (+ test), `category-picker.tsx` (+ css, test), `recent-categories.ts` (+ test).
Tests: path building and ordering by class and sign; archived and system accounts excluded; accent-insensitive filter; recents order and cap; picker keyboard choose; create-on-miss sends `POST /accounts`.
Commit: `feat(web): add the category mark and the category picker`

### Task 2: Transactions list
Files: `transactions-page.tsx`, `transactions-grid.tsx`, `transaction-filters.tsx`, `transactions-tabs`, `search.ts` (category handling), `api.ts`.
Tests: rows rendered from two cursor pages; filters write the URL and the request query; Account and Category replace each other; Uncategorized tab sends `uncategorized=true` and shows its count; empty and error states; voided row mark.
Commit: `feat(web): list transactions with filters and the uncategorized queue`

### Task 3: Categorizing from the list
Files: `category-cell.tsx`, `bulk-categorize.ts` (+ test), `use-categorize.ts`, `selection-bar.tsx`, `similar.ts` (+ test).
Tests: inline choose sends the single-part body with `expected_version`; Undo restores the previous parts; bulk in chunks of 200 with mixed results reported; similar count and "Apply to n similar"; `C` shortcut.
Commit: `feat(web): categorize transactions inline and in bulk`

### Task 4: Transaction detail
Files: `transaction-detail.tsx` (shared body), `transaction-panel.tsx`, `transaction-page.tsx`, `split-editor.tsx` (+ test), `void-dialog.tsx`, `transfer-dialog.tsx`, `attachments-section.tsx`, `history-section.tsx`.
Tests: panel opens from `?selected=` at 1280 px and the page at 390 px; split remainder and submit body; void sends reason; 404 and error states; conflict re-read message; categorization method line.
Commit: `feat(web): show a transaction with its postings, history and actions`

### Task 5: Entry form
Files: `transaction-form.tsx`, `entry-kind.ts` (+ test: kind ↔ postings), `postings-editor.tsx`, `payee-field.tsx`, `form-draft.ts` (+ test), `new-transaction-page.tsx`.
Tests: expense body postings and signs; transfer body; advanced imbalance blocks submit; field errors from a 422 under their fields; draft restored after leaving; payee create.
Commit: `feat(web): record transactions with a guided form`

### Task 6: Correction form
Files: `correct-transaction-page.tsx`, `correction-conflict.tsx`.
Tests: prefill per kind; body carries `expected_version` and reason; 409 shows moved fields and both choices.
Commit: `feat(web): correct a transaction and resolve version conflicts`

### Task 7: Categories destination and tree
Files: `app/shell/destinations.ts`, `shell-icon.tsx` (tag icon), `command-menu.tsx`, `router.tsx`, `features/categories/*` (`categories-page.tsx`, `category-table.tsx`, `category-dialog.tsx`, `appearance-picker.tsx`, `merge-dialog.tsx`, `api.ts`).
Tests: destination and palette entries; totals per period; create, rename, move (cycle error), appearance, merge, archive and reopen bodies; `system_account` refusal message.
Commit: `feat(web): manage the category tree`

### Task 8: Rules list, suggestions and statistics
Files: `rules-page.tsx`, `rule-list.tsx`, `suggestion-card.tsx`, `source-categories.tsx`, `rule-text.ts` (moved from admin, admin imports it through `features/categories/index.ts`).
Tests: order and reorder body; enable toggle sends PUT with the full rule; accept and dismiss; run rules toast; source-category mapping body; statistics figures.
Commit: `feat(web): manage categorization rules and suggestions`

### Task 9: Rule editor with preview
Files: `rule-editor-page.tsx`, `condition-row.tsx`, `action-row.tsx`, `rule-draft.ts` (+ test: draft ↔ RuleInput, validation), `rule-preview.tsx`.
Tests: create and replace bodies; value typing by field; between and in_list; split parts; preview debounced call and result rows; prefill from search parameters; delete.
Commit: `feat(web): write categorization rules with a live preview`

### Task 10: Payees and aliases
Files: `payees-page.tsx`, `payee-aliases.tsx`, `merge-payees-dialog.tsx`.
Tests: rename body; merge body and list refresh; alias create, edit, delete bodies.
Commit: `feat(web): manage payees and their aliases`

### Task 11: Review pass
Run `review-screen` over every screen of tasks 2–10; fix each finding; run `make check`; report Slotted findings.
Commit: `fix(web): ...` per finding group, when any.
