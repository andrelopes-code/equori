# Web redesign, sub-projects R2–R6: complete frontend

- Date: 2026-10-18
- Branch: `feat/web-ledger-sheet`
- Depends on: `docs/superpowers/specs/2026-10-18-web-ledger-sheet-design.md` (L1–L18). This spec amends L3, L4 and L5 and delivers R2–R6 of its redesign track in one branch.
- Source: the owner's prototype "Conceito B v3" and the owner's review of R1: page headers carry only a title, header actions and forms have poor inner spacing and alignment, the prototype's charts, forecast, budget and detail panel are missing.

## Global presentation

| ID | Decision |
|---|---|
| G1 | Density `comfortable` at every width (amends L3), as the prototype handoff states. |
| G2 | `PageHeaderDefaultsProvider` `variant="plain"`: a header paints no band. Module screens (Overview, Transactions, Goals, Cards, Accounts) use `size="lg"`; record and form screens `size="md"`. |
| G3 | Every header names its context: a module screen carries a subheading with its headline fact; a record or form screen carries `PageHeaderBack` to its module, a subheading and marks (`Tag`) for its state. |
| G4 | `SectionDefaultsProvider` `size="sm"` `divider`: a section title is 14 px semibold over a thin rule. Sections of one page stand `--slotted-space-11` apart at ≥ 1024 px and `--slotted-space-9` below. |
| G5 | Pages: `PageDefaultsProvider` `inset` 9 at ≥ 1024 px, 6 at 600–1023 px, 4 below. |
| G6 | Header and toolbar actions are `size="md"`. The top bar "New" keeps `size="sm"`, `Kbd` `size="xs"`. |
| G7 | Destinations (amends L4, L5): Overview, Transactions, Goals, Cards, Accounts. The phone bottom bar keeps four controls: Overview, Transactions, Cards, More; More lists Goals, Accounts, Settings, Colour scheme, Language, Log out. |

## Shell, second pass

Source: the owner's review of G7: the top bar read as tabs, generic components carried the screens. These decisions amend L4, L5, L7 and G7.

| ID | Decision |
|---|---|
| S1 | From 1024 px the destinations stand in a ledger index beside the page, an own element: the wordmark, the entry trigger drawn as a field (the action "Lançar" with the N key, an example line "almoço 42 ontem" under it), the destinations Overview, Transactions, Goals, Cards, Accounts, each with its figure as the link's description (available balance, uncategorized count in the warning tone, share saved across the base-currency goals, what the cards owe, net worth), then the sync status and the account row (avatar, e-mail, "Conta e preferências"; on hover a tint of the text colour and a chevron that slides in), with no rule above them. The index fills the shell's nav region and only its list scrolls. The current destination carries a rule on its left edge in the text colour. |
| S2 | Below 1024 px a bottom bar of five text controls: Home (the overview's short name), Transactions with its count, New drawn in ink (inverse surface), Cards, More. New preselects the open account. No page header carries New. |
| S3 | Page insets: 32 px from 1024 px, 24 px from 600 px, 16 px below (amends G5). The shell's navigation is held open: left to itself it closed when the window narrowed and came back as a rail when it widened. |

## R2 Overview

| ID | Decision |
|---|---|
| O1 | The overview reads a month, `?month=YYYY-MM`, the current month by default. The header holds the month name as title, the sync status as subheading, and previous and next `IconButton`s; next is disabled on the current month. |
| O2 | Scope of the forecast: the accounts of the Available balance group in the base currency. Realized days come from `/reports/balances` per account, summed per day; future days from `/accounts/{id}/projection?to=<month end>`, summed per day over each account's running balance. |
| O3 | Header area figures (FigureStrip): "Balance today"; "Forecast for <month end>" in the accent tone with the difference to today as caption; "Lowest until then" with its day and the occurrence that causes it; "<Month> so far" as a description list of Income, Spending and Saved, read from the month's transactions of the scoped accounts. A past month shows "Closing balance", "Opening balance", "Lowest balance" and the month's flows. |
| O4 | Chart: `Chart` line, `curve="step"`, two series over the month's days: realized (neutral, solid) up to today and forecast (accent, dashed) from today; an x annotation "Today" in the accent tone; x annotations on the three largest occurrences of the remaining month, labelled with their description. `size="md"`, `toolbar="hover"`, no legend. A custom tooltip shows weekday and date, "forecast" or "today", the balance and the day's occurrences or "No movement". |
| O4' | An occurrence is annotated only when it stands eight days or more from today and from the occurrences already annotated: a label ends on its line, and closer lines made the labels overlap. |
| O5 | "Until month end": a table of the remaining occurrences of the scoped accounts (date, description · schedule kind, signed amount), a summary row "<month end> · Forecast balance" with the closing balance in the accent tone, and a note on what the forecast adds. |
| O6 | "Budget": a table of the month's budgets (Category, Spent, Budgeted, Left, bar), a summary row with the totals. Left reads danger when negative and warning when the spent share exceeds the month's elapsed share by more than 15 points. The bar is an own element `ui/budget-bar`: a 2 px track, the spent share filled, a 1 × 10 px mark at the elapsed share of the month (current month only). |
| O7 | Layout from 64 rem: header area, chart, then "Until month end" and "Budget" in two columns (`1fr 1.3fr`); recent transactions and accounts follow in two columns. Below 64 rem every block stacks. |

## R3 Transactions

| ID | Decision |
|---|---|
| T1 | From 1024 px a selected row opens a detail pane of 22 rem beside the table, `?selected=<id>`; a click on the description selects instead of navigating; the pane links to the full transaction page. Below 1024 px a row opens the transaction page. |
| T2 | Pane: weekday and date, title, amount as `MoneyFigure` `xl`; an `InlineMessage` warning for an uncategorized transaction; the expense or income categories as a `ToggleGroup` of single choice; a ruled `DescriptionList` of Account, Origin, Payee, Tags; actions Correct, Void and Open as links. |
| T3 | Choosing a category calls `categorize` with the loaded version and shows a toast "<title> now in <category>" with an Undo action (5 s) that categorizes back to the previous category. The uncategorized count updates through query invalidation. |
| T4 | Without filters, the expected occurrences of the next 31 days of every account stand above the table in muted text, the farthest first like the rows under them, closed by a row "Today" in the accent tone. A phone shows them as a "Scheduled" day group. |

| T6 | The pane offers the categories as the ink chips of the entry sheet; while it is open the table gives its Category column to the pane. |
| T5 | Withdrawn on the owner's review: the transactions page keeps the library's filter bar, with its search field, filter chips and pills. |

## R4 Cards

| ID | Decision |
|---|---|
| C1 | `/cards` lists the card accounts; one card redirects to its page. |
| C2 | Card page header: card name as title, "<statement month> statement" subheading, marks for the statement state; header area figures: statement amount (`MoneyFigure` `xl`), Closes, Due, Available limit. Actions: New purchase, Pay statement, card settings in a menu. |
| C3 | The open statement's lines as the ledger table (L15), summary row "Statement total · N lines". Beside it at ≥ 1024 px, "Committed in coming statements": a table of the next six months from `/accounts/{id}/commitments` with a bar per month. Earlier statements follow as a table (month, due, state, amount). |

## R5 Goals

| ID | Decision |
|---|---|
| R5-1 | `/goals`: header with the total saved and the count of goals; a table Goal (name, due date), Saved, Target, a progress bar, "Monthly" (slider 50–5 000, step 50, value beside), "Ready by" (month of completion), summary row with the totals. |
| R5-2 | Completion month = current month + ceil(remaining / monthly). It reads warning when after the due date. The slider is a what-if held in the page state; nothing is saved. Defaults: remaining divided by the months until the due date, rounded up to 50. |
| R5-3 | A phone shows one block per goal: name and completion, "saved of target" and due date, the bar and the slider. |

## R6 Forms and quick entry

| ID | Decision |
|---|---|
| F1 | Create and edit forms: `Page width="content"`, `FieldGroup`s with legends for "Amount and date", "Accounts" and "Details"; Amount and Date share one row from 600 px; the actions stand in the form footer, end-aligned, the primary last. |
| F1' | Second pass, replacing F1 after the owner's review (generic forms): the form is an entry sheet. The kind of transaction is a text switch of three words (own element, radio group); the amount is the headline figure, an own field at the 4xl step whose digits fill from the cents; the balance accounts and the categories (or the transfer's two accounts) are chips to tap, the chosen one in ink; date, payee, description and tags keep their fields. Labels stand beside the controls from 600 px. Below the sheet, the balance the entry leaves in its account reads in the accent tone; Save is drawn in ink, the secondary action as a ghost button. The header leads back to Transactions. The split and postings editors keep their pickers. |
| F2 | Quick entry: N and the top bar "New" open a `Dialog` (desktop) or a full-screen `Drawer` (phone) with one free-text field. The text is parsed into amount, date (today, "ontem"/"yesterday", "anteontem"), account (card, cash keywords; otherwise the first checking account), category (keyword match on category names and the payee history) and description. A preview `DescriptionList` shows the parse; the categories are a `ToggleGroup`; Enter posts the transaction, closes the dialog and shows a toast with Undo (void). "More fields" opens the full form with the parse as its draft. |

## Accounts and settings, second pass

| ID | Decision |
|---|---|
| A1 | The accounts page header states the balance sheet: net worth as subheading; Assets, Liabilities (as owed) and Net worth as figures, in the base currency. |
| A2 | Balance accounts read as a ledger table per class (account linked to its page, a card to its card page; kind; balance; actions menu), sub-accounts indented under their parent, closed by a total on a double rule. The ledger is a table of the app's own: the table family re-measures on every row menu's open. |
| A3 | Categories carry no balance and read as an index of names in columns per class (income, expense, equity), each with its actions menu. From 64 rem the index stands beside the balance sheet. |
| P1 | Settings: the header counts what the page holds; sections stand apart; a locked base currency reads as a statement (code and name) instead of a disabled select; institutions and payees are ruled lists in columns with their count; language and colour scheme are text switches. |

## Tests

Each decision with behaviour has a test through `renderApp`: O1 month navigation and the disabled next control; O2/O3 the figures from fake balances and projections; O5 rows and summary; O6 left tones and the mark position; T1 selection and pane; T3 categorize and undo calls; T4 occurrences above "Today"; C1 redirect; C3 summary row; R5-2 completion months and the warning; F2 the parser cases of the prototype ("almoço 42 ontem", "uber 23,90 cartão", "recebi freela 1200") and the posted body. Pure logic (series merge, lowest point, pace, completion month, parser) has unit tests.

## Verification

`make check`; every route at 360, 768 and 1280 px in pt-BR and en against the seeded review account, compared with the prototype screenshots.
