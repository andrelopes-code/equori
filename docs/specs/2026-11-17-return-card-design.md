# Return card: gain first

Status: accepted. The owner confirmed the order of the blocks and approved concept A of the mock on 2026-11-17 (`docs/specs/assets/2026-11-17-return-card/`, opened through `index.html` on a static server). The mock is the contract for every measure this document does not state.

## 1. Intent

The return view is the body of the section "How it performed" of the portfolio page and of the yield section of an account page (`ReturnView`). Before this change it wrote the return of the portfolio as four values under one name, listed the gain in money as the third of four equal rows, and wrote the closing balance, the net deposits and the gain twice each. The view now answers three questions in order: how much the user gained, whether that beat the references, and where the closing balance came from.

## 2. Goals, non-goals

Goals:

- G1. The gain of the period in money is the focal point of the view.
- G2. Each amount and each rate is written once.
- G3. A region the report does not hold is absent; no placeholder stands for it.
- G4. No text of the view touches or covers another at 1024 px and at 1440 px.

Non-goals: a phone form (`/portfolio` and the account page's yield tab are desktop screens, ADR 027), a time series (the API returns none), a change to the detail layer, to the comparisons' figures or to the API.

## 3. Rules

- RK1. The view leads with the gain in money (`returnMoney`, RC4) under the label "Gain in the period", beside the verdict sentence of HR3. A negative gain takes the danger tone and its minus sign. A report whose amounts differ in currency has no gain and leads with the sentence alone; a report without a verdict leads with the gain alone. A rule separates the two only when both draw.
- RK2. Under the lead, the comparisons (RC2, RC3) stand beside the origin block. Each column is at least 28rem wide; below two such columns the origin block goes under the comparisons. A column that stands alone is at most 40rem wide.
- RK3. The origin block is titled "Where the closing balance came from" and lists the opening balance, the net deposits (only when the period has flows), the gain and the closing balance, each with its help (HR6). The inner section "In money" and the growth bar with its own legend are removed.
- RK4. A bar splits the closing balance into opening balance, net deposits and gain when the gain is above zero, no part is negative and at least two parts are above zero (`originParts`). A part of zero is left out. The rows of the drawn parts carry the swatch of their segment. The bar is drawn for an account as well as for the portfolio; this replaces RC9, which limited the growth bar to the portfolio.
- RK5. A negative bar of a comparison writes its value after the zero line when the axis has a positive side, and before the bar's start otherwise. The positive side of a signed axis spans at least one third of the track (`comparisonAxis`, at most three steps), so the value has room on a track of 28rem.
- RK6. The foot holds the notes and the profile sentence at its start, and at its end the annual rate ("Annual rate 5.00%") beside the button of the detail layer. The summary no longer repeats the closing balance and the period return.
- RK7. While the report loads, the card of the portfolio draws one line for the lead and one block per column.

The empty state, a failed read and an undefined return are unchanged.

## 4. Scenarios of the mock

Each state of the mock is a real report of the demo book; `mixed` is the portfolio report with the currency of one flow changed.

| State | Report | Regions |
|---|---|---|
| `data` | All brokerages, 12 months | Lead, two comparisons, bar of three parts |
| `rate` | Fixed income account | Chip with the percent of the index |
| `noflows`, `savings` | Account without flows | No deposits row, bar of two parts |
| `nobench` | Reserve without a comparison | Lead and origin in one column, reason at the foot |
| `long` | Five years | Verdict with the annual rate, one comparison |
| `mixed` | Flows in two currencies | Sentence and comparisons, no gain and no origin |
| `hard` | Loss and net withdrawal, 13-digit amounts | Gain in the danger tone, no bar, values after the zero line |
| `undefined`, `empty`, `error` | No report | As before |
| `loading` | Pending read | RK7 |

## 5. Client derivations

| Value | Rule | Test |
|---|---|---|
| Gain in money | closing − opening − net deposits (RC4, unchanged) | `return-money.test.ts` |
| Parts of the origin bar | RK4 | `origin-parts.test.ts` |
| Position of a negative value | RK5 | `return-bars.test.tsx` |

## 6. Cross-cutting questions

- R1. Does not apply: the view adds no regional value; the indexes and their names come from the report.
- R2. A region without an index returns no comparison; the lead and the origin block stand in one column (state `nobench`).
- R3. Does not apply: no value set is added.
- R4. Does not apply: no extension point is added.
- R5. `return.lead.gain`, `return.origin.title`, `holdings.method.annual`, in pt-BR and en. `return.money.title`, `return.growth.title`, `holdings.method.summary` and `holdings.method.summaryNoPeriod` are removed.
- R6. Amounts through `useMoneyFormat()`, rates through `formatBasisPoints` with the active tag.
- C1. The gain and the parts of the bar are integers of minor units in the currency of the report.
- C2. The gain and the bar exist only when the opening balance, the closing balance and every flow share one currency (`returnMoney`); otherwise both are absent (state `mixed`).
- C3. The report is valued in the currency of the page's `value_in`; the view reads the currency of the report.
- C4. The currency comes from the report; every amount goes through `useMoneyFormat()`, so privacy mode hides it.
- T1. Does not apply: the view uses no date of its own.
- T2. Does not apply.
- B1. Does not apply: no table.
- B2. Does not apply: no operation.
- B3. Does not apply: no setting.
- D1 to D5. Do not apply: no table, schema, recorded fact, import or diagnostic field.
- S1. Does not apply: no operation and no `Problem.code`.
- S2. No: both screens are desktop screens (ADR 027); the view is verified at 1440 px and 1024 px.
- S3. The reading order of the section changes; `internal/assistant/guide/articles/investments.md` and the help article `portfolio.md` (pt, en) change in the same commit.
- S4. Does not apply: the assistant reads the report through its existing tool.
- X1. Does not apply: no scenario of `docs/domain/06-scenarios.md` is added.
- X2. `return-money-panel.test.tsx`, "draws nothing when an amount is in another currency", covers C2. No test runs outside Brazil, since R1 does not apply.
