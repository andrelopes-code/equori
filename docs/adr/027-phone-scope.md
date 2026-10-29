# ADR 027: Phone scope

- Status: accepted
- Date: 2026-10-29
- Amends: `docs/domain/01-vision.md` §1.10 ("Native mobile apps"), `docs/contributing/mobile.md` M1, ADR 022 (phone form)

## Context

Every screen of `web/` had a phone layout below 600 px (`docs/contributing/mobile.md`). On 2026-10-29, 70 source files under `web/src` held a branch, a component or a style for that width. Each new screen paid for two layouts and two sets of tests. Setup, bulk and analysis screens (rules, budgets, imports, portfolio, reports) are used at a desk. The owner's use of a phone is capture, lookup of balances, transactions and statements, and settings.

## Decision

| ID | Rule |
|---|---|
| S1 | The phone is the compact size class of Slotted: widths below 600 px (`compactQuery` in `web/src/ui/use-media-query.ts`). |
| S2 | A route under the authenticated shell is served on the phone only when its definition in `web/src/app/router.tsx` sets `staticData: { phone: true }`. A route without it is desktop-only. A new route is desktop-only unless its design says otherwise. |
| S3 | Phone routes: `/`, `/accounts`, `/accounts/$id`, `/cards`, `/cards/$accountId`, `/cards/$accountId/statements/$statementId`, `/transactions`, `/transactions/new`, `/transactions/capture`, `/transactions/queue`, `/transactions/$id`, `/transactions/$id/correct`, `/settings`, `/settings/appearance`, `/help`, `/help/$page` (amendment of 2026-10-29: a phone route that explains itself, the statement, links to its help page; amendment of the same day: the appearance studio, which the settings pane held, keeps the phone under `docs/specs/2026-10-29-appearance-studio-design.md` A7). `/login`, `/setup` and `/offline` sit outside the shell and are always served. |
| S4 | On the phone, a desktop-only route renders the notice `WideScreenNotice` in place of the page: a title, a sentence that the screen needs a width of at least 600 px, and a link to the overview. The shell (top app bar, dock) stays. |
| S5 | Tabs of a phone route that are desktop-only: on `/accounts/$id`, every tab except `activity`; on `/cards/$accountId`, `cards` and `settings`. On the phone the tab list omits them, and a URL that names one shows the route's default tab. |
| S6 | The phone dock and the More sheet list only destinations whose route is a phone route. The command palette lists every destination; a desktop-only one leads to S4. |
| S7 | A desktop-only screen, tab or drawer holds no code for widths below 600 px: no `compactQuery` branch, no `PhoneList` or `PhoneGroup`, no `max-width: 599px` rule. Its tests render at desktop width. |
| S8 | The assistant panel stays on the phone as a bottom drawer. |
| S9 | On the phone, a link or an action of a phone route whose destination is desktop-only is left out; a link drawn through `AppLink` draws as its text. `useServed` (`web/src/ui/use-served.ts`) decides from the route definitions: `staticData.phone`, and `staticData.phoneTabs` for a route with tabs (S5). |

## Consequences

- A new screen is designed and tested at desktop width only. `docs/contributing/mobile.md` applies to the routes of S3.
- A route is promoted to the phone by an amendment of S3 that also adds its phone layout and tests.
- The notice of S4 answers what S9 leaves out: a typed URL, a bookmark or a command of the palette.
