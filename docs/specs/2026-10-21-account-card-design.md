# Account card

The visual specification of the card (layout, material, art, meter texts and states, hidden values, loading, formatting, accessibility, preview cases) is the owner's brief "Implementar o componente Cartão da conta (AccountCard)", quoted in the session of 2026-10-21. This document records how equori adapts it. Where they differ, this document wins.

## Intent

The cards destination (`/cards`) lists each credit card as a plain Slotted card (`features/cards/card-tile.tsx`). The account card draws an account as a physical card: the account colour as material, the institution logo, the amount, a meter and a short spending signal. The cards destination is where a card is the subject of the page, so it is the first and, in this delivery, only place that uses it.

## Goals

- A reusable component `AccountCard` for three card kinds: `checking`, `credit`, `savings`.
- A preview screen with the seven preview cases of the brief.
- The cards destination draws each card with `AccountCard`, followed by the statement strip described below.
- A backend read of daily inflow and outflow per account. The spending signal and the checking meter need it.

## Non-goals

- The account card on any other screen: account list, account page, overview.
- An application-wide "hide values" switch. `hidden` is a prop, exercised by the preview only.
- A choice of colour outside the eight data slots of the theme.

## Anti-goals

- Any figure the application does not hold. No card number, last four digits, brand, expiry date or holder. An element without data is not drawn, and the card keeps its proportion without it.
- A state shown by colour alone.
- Art behind the amount or the labels.

## Constraints

- `docs/contributing/web.md`:
  - O1: one component per file, kebab-case;
  - O2: cross-feature imports go through `index.ts`;
  - O5: CSS in `*.module.css` inside `@layer app`, `var(--slotted-*)` only;
  - O6: no literal text in JSX;
  - O7: money as an integer plus an instrument code, with no floating-point division to text.
- The component is an own element. It is written under the `build-own-element` skill, and its comment says it is a deliberate visual-identity element and not a Slotted finding.
- No new dependency. The brief names culori for React Native only. The web uses CSS relative colour syntax.
- Backend:
  - ADR 002, module boundaries: the read belongs to `reporting`;
  - ADR 003: every query filters by `user_id`;
  - ADR 004: problems;
  - schema change by a new goose migration;
  - an entry in `internal/server/tool_exposure_test.go`;
  - scenario tests through `internal/apitest`.

## Backend: daily flows

### Amendment

Amendment A119 is the next free number at the time of writing; the plan confirms it.

`reporting_account_day` gains `inflow_booked` and `outflow_booked`, both `bigint NOT NULL`:

- **Inflow:** the sum of the positive amounts of the account's non-voided postings booked on the date.
- **Outflow:** the sum of the absolute values of the negative amounts.

Both are zero or positive, and `inflow_booked − outflow_booked = delta_booked`. A schema test violates each invariant with direct SQL:

- `CHECK (inflow_booked >= 0 AND outflow_booked >= 0)`;
- `CHECK (inflow_booked - outflow_booked = delta_booked)`.

Under the ledger's sign convention, a card purchase is a negative posting on the card account. A refund or a statement payment is a positive one (`docs/domain/03-domain-flows.md`, `PurchaseRefunded`). Outflow is therefore spending on every account kind. A transfer between the owner's own accounts counts as inflow on one account and as outflow on the other, so a statement payment from checking is checking outflow.

Today `InsertAccountDaysFrom` drops a day whose net delta is zero (`HAVING`). With flows, a day keeps its row when its inflow or its outflow is not zero. Balance series and category totals read `delta_booked`, so the additional rows with a zero delta leave their results unchanged. Their existing tests prove it.

The migration adds the columns and fills them from `ledger_posting` in SQL. The migration file states the reason: the projection already exists, and its rows must satisfy the new checks.

### Endpoint

`GET /reports/flows?account_id&from&to`, tag `reporting`, operation `getAccountFlows`.

- **Response:** `{items: [{date, inflow: Money, outflow: Money}]}`, one item per date in `[from, to]` that has a row, in date order, in the account's instrument.
- **Scope:** the named account only, with no subtree.
- **Range:** at most 366 days. Validation:
  - `to < from` returns 422 `invalid_range`;
  - a range longer than 366 days returns 422 `range_too_long`;
  - an unknown account returns 404.

The builder confirms the problem codes against the codes reporting already returns and reuses an existing one where it means the same thing.

### Scenarios

Scenarios S115 and onward (next free numbers, confirmed by the plan), each with an `apitest` test:

- flows of a checking account with an income, a purchase and a transfer to savings on one day;
- flows of a credit card with purchases, a refund and a statement payment;
- a day whose inflow equals its outflow is listed with zero delta;
- a voided transaction is absent;
- another user's account returns 404;
- each problem code.

## Component

`features/accounts/account-card.tsx`, with `account-card.module.css`. It is exported from `features/accounts/index.ts`. Pure helpers sit in `account-card-meter.ts` (state, percent and texts of the meter) and `account-card-money.ts` (integer and cents split), each with table tests.

### Props

The props of the brief, adapted:

- `value` is `Money` plus `scale`. The meter's `used` and `total` and every `signal` entry are integers in the same instrument.
- `color` is the data slot `1..8` or `undefined`.
- The preview needs raw colours (yellow, pink) that no slot holds. The component therefore takes the colour as a CSS custom property set by the caller (`--account-card-color`). A helper maps a slot to `var(--slotted-data-n)`, and the preview sets any CSS colour.
- `institutionLogo` is a URL from `logoURL()`.
- `monogram` is the first letters of the institution name, two at most, upper case.
- `title` is the text of the header. On the cards destination it is the account name.
- `href` makes the whole card one link (owner review of 2026-10-21). The link carries the card's accessible name and is described by the chip and meter texts. It rises 2 px under the pointer and draws the page's focus ring. Without `href`, the card is a `group`.
- A logo sits on an opaque white tile, because the catalogue's logos are drawn for a light ground (owner review of 2026-10-21).
- `hidden` and `loading` are as in the brief.

### Material

- Background `oklch(from var(--account-card-color) 0.4 c h)`, with the plain colour as fallback for browsers without relative colour syntax.
- An account without a colour is a graphite card: a 135° gradient from `oklch(0.34 0.012 265)` to `oklch(0.18 0.008 265)` (owner review of 2026-10-21, which rejected the grey at L = 0.4). Its lightest stop is darker than L = 0.4, so white text keeps more than the 9.15:1 measured at L = 0.4.
- Shadow and border follow the brief.
- The top highlight is an inset shadow (`inset 0 1px 0`, white 18%). It follows the corner radius. The brief's 1 px element sat inside the border and read as a floating bar (owner review of 2026-10-21).
- Art (owner review of 2026-10-21, which rejected the brief's interlaced waves):
  - the SVG covers the card, in units of 340 by 214;
  - it is drawn around a centre at (352, 107), just past the right edge;
  - a radial mask, scaled to 0.52 vertically, fades it out before the header, the amount and the meter, so no line ends on a straight edge;
  - opacity 0.3; white strokes of 0.75 px with `non-scaling-stroke`;
  - credit: a guilloché rosette of 16 ellipses (150 by 50) turned about a point 40 units further right;
  - checking: 14 ripples of radius `10 + 7k + 0.35k²`;
  - savings: 14 contour rings of radius `10 + 10k`, modulated by `sin 3θ` and `sin 5θ` with a phase that drifts per ring;
  - mask ids come from `useId()`.

### Texts

All text comes from `useT()`, with keys in both catalogs (`catalog-accounts.pt-BR.ts`, `catalog-accounts.en.ts`):

- kind words: CONTA, CRÉDITO, RESERVA;
- default labels, chip legends and meter texts;
- "Meta atingida";
- the accessible label;
- "valor oculto".

### Percent

`pct = round(used × 100 / total)`, on integers. It is a ratio, not money to text, so O7 does not apply.

### Geometry

- The card's inline size runs from 280 px to 400 px, with `aspect-ratio: 1.586`.
- The cards grid tracks are `minmax(min(100%, 280px), 1fr)`. The card caps itself at 400 px.

## Kind mapping

| `Account.kind` | Card kind |
|---|---|
| `credit_card` | `credit` |
| `savings`, `reserve` | `savings` |
| any other kind | `checking` |

The mapping is a pure function with a table test. The cards destination only meets `credit_card`.

## Data on the cards destination

| Element | Source |
|---|---|
| value | `current.amount_due` of `useCardStatements` |
| context | "vence DD mmm" from `current.due_date`; absent when there is no current statement |
| meter | used = `credit_limit − available_limit`, total = `credit_limit` (the computation of `card-tile.tsx`); absent without a limit |
| signal | outflow per day from Monday of the current week to today, from `getAccountFlows`; at least two days, so on a Monday there is no chip |
| logo, monogram | institution of the account, `logoURL(index, institution.ispb)` |
| colour | `account.color` |

With no current statement, the card draws no value. The strip says "sem fatura aberta" (`cards.noStatement`).

## Statement strip

Below each card, in the same `article`:

- the statement status tag;
- "fecha em X · vence em Y";
- the debt of earlier unpaid statements, with the "Pagar" button.

These are the strip elements of `card-tile.tsx`. The `ProgressBar` of that tile is removed, because the card's meter replaces it. The figure grid at the top of the destination does not change.

## Preview screen

Route `/preview/account-card`, registered only when `import.meta.env.DEV` is true. It is absent from the production bundle. It renders the seven cases of the brief with fixed data, including a raw yellow (`#f5c400`) and a raw pink (`#ff4fa0`).

## Verification

- **Component tests:**
  - every element is absent when its data is absent;
  - hidden values;
  - meter text and icon at 79/80/89/99/100/104 % for credit and at 89/90/100 % for checking;
  - "Meta atingida";
  - the `meter` role and its values;
  - the accessible label.
- **Contrast:** checked on the preview in Chromium, through one Playwright script under the browser rules of the user instructions. The background of each of the eight slots in both schemes, plus yellow and pink, is read with `getComputedStyle`, and the contrast of white is asserted ≥ 4.5:1.
- `make check-commit`.

## Left to the builder

- Order of slices: backend flows, then component and preview, then the cards destination.
- Names of the helper files and of the i18n keys.
