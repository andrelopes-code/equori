# web/

Paths in the Slotted sections are relative to `web/`.

@node_modules/@slotted/react/dist/docs/AGENTS.snippet.md

<!-- Workaround for Slotted findings "No command keeps the agent instruction snippet in sync with the installed version" (this import) and "No command makes the skills available to a coding agent" (symlinks in ../.claude/skills). -->

## Slotted feedback (mandatory)

Slotted is the owner's own library, in beta, and equori is its only consumer: the app is the test bed that calibrates it. The owner fixes the library in its own repository. A defect worked around here and not reported is a defect that stays in Slotted.

A Slotted finding is a bug to fix, an improvement to something that exists, or a feature the library should offer, in any area the library covers:

| Area        | Covers                                                                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `family`    | a component family or one of its parts: rendering, behaviour, state, focus, keyboard, resize, performance (a slow test caused by the family counts), a missing prop, variant, slot or state                                                                   |
| `token`     | a theme value the app needed and the theme does not hold, or a token that resolves wrong in a scheme                                                                                                                                                          |
| `utility`   | a hook or helper the package exports (`useField`, formatting, date, chart engine helpers)                                                                                                                                                                     |
| `docs`      | a family file under `dist/docs/` that is missing, wrong or misleading                                                                                                                                                                                         |
| `guideline` | a rule under `dist/docs/guidelines/` that is wrong, missing, contradictory or produces a poor result when followed                                                                                                                                            |
| `agent`     | the package's instructions for agents (`dist/docs/AGENTS.snippet.md`, `dist/docs/index.md`, `dist/docs/skills/*/SKILL.md`): a missing or unclear instruction that led an agent, here or in a subagent, to a wrong component, a wrong pattern or a wasted pass |

An own element is a finding only when the need is general, one that any app using the family would meet, and the family should answer it. An own element built for equori's visual identity, where a family's look would make the app read like every other app (the navigation), is a deliberate choice and not a finding; its build-own-element comment says so. When such an element had to rebuild what the library could share (focus ring, current-route matching, roving focus, a state layer), that shared piece is the finding, in the `utility` or `token` area, not the element.

The source does not matter: a problem found during the work and a problem the owner points out are both findings once the diagnosis places its cause, in whole or in part, in one of the areas above. Diagnose first; a problem whose cause is in equori's own implementation is fixed in `web/` and is not a finding. Every finding gets its own report and its own prompt; findings are never merged into one vague prompt.

Rules:

1. Every finding is reported to the owner in the reply of the task that met it, in a section titled `Slotted findings`, numbered from 1 within the reply. No finding is dropped because the app works around it.
2. Each finding follows the template below exactly: same fields, same order, no field omitted (write "none" when a field has nothing). The prose is written in the conversation's language; the prompt is always in English.
3. The prompt stands alone, for a session that knows nothing of equori. For a `bug` it states the observed behaviour, the expected behaviour and a minimal reproduction; for an `improvement` or a `feature` it states the need met in equori, the proposed API (props, parts, states, tokens, rule text or instruction text) and how it composes with what exists; for `guideline` and `agent` areas it quotes the current text (file and section) and gives the replacement or addition. Every prompt ends with an `Acceptance:` line and asks for a test or check that fails before the change.
4. A workaround in `web/` (code, CSS, theme rule or test) carries a comment with the finding's exact title in one phrase: `Workaround for Slotted finding "<title>"`. The title is the key of the finding in `docs/slotted-findings.md`; it is never reworded or alternated with a synonym, and a second workaround for the same finding quotes the same title.
5. Every finding reported is added to `docs/slotted-findings.md` in the same change: `reported` while no workaround exists, `open` once a comment names it.
6. When a new Slotted version is installed, run each `open` finding's `Remove when` condition against it. For each one the version fixes, remove the workaround and its comment, remove any test that exists only for the workaround, and set the row to `fixed`, all in one commit whose body names the finding. A test that exists only for the workaround is removed under this rule, not under the root rule on deleting tests.
7. `src/testing/slotted-findings.test.ts` checks the registry against the comments; `make check` runs it.
8. `node_modules/@slotted/*` can hold a local build, written by `pnpm sync:equori` in `../slotted`; `package.json` and the lockfile always name the published version. A check that passes only on a local build does not close a finding. `pnpm install --frozen-lockfile --force` returns `node_modules` to the published version.

Template (one block per finding):

````markdown
### N. <short title: what is wrong or missing>

- **Kind:** bug | improvement | feature
- **Area:** family | token | utility | docs | guideline | agent — <family and part, token name, export, or file and section>
- **Problem:** <one or two sentences: the observed behaviour or the gap>
- **Evidence:** <screen and width, browser measurement, test name and timing, file and line in web/, or the agent step that went wrong>
- **Version:** <the installed Slotted version the problem was observed on>
- **Impact on equori:** <what the user sees or what the work cost>
- **Workaround:** <file in web/ and what it does, or "none">
- **Remove when:** <the observable condition that proves the fix, such as the assertion that passes without the workaround, or "none" when there is no workaround>

```
<Kind> — <area and subject>.
<Observed/expected/repro, or need/proposed API/composition, or current text/replacement.>
Acceptance: <the test or check that fails before the change and passes after>.
```
````

## Rules

File names under `web/src` are kebab-case (O1). This is the only exception to the snake_case rule of Naming in the root `CLAUDE.md`.

The application sets `data-slotted-theme="equori"` and loads `@/theme/equori.gen.css` in place of the `default` theme and `@slotted/themes/default.css` of the Slotted UI section.

| ID  | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Gate                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| O1  | One component per file; the file is named after the component in kebab-case.                                                                                                                                                                                                                                                                                                                                                                                                               | ESLint `react/no-multi-comp`     |
| O2  | A feature imports another feature only through its `index.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                             | ESLint `no-restricted-imports`   |
| O3  | `@/api/client` is imported only by `features/*/api.ts`, `features/session/**`, `app/providers.tsx`, `src/api/**` and `src/testing/**`.                                                                                                                                                                                                                                                                                                                                                     | ESLint override by glob          |
| O4  | `features/*` never imports `@/app/*`.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | ESLint                           |
| O5  | App CSS lives in co-located `*.module.css` inside `@layer app`, reads only `var(--slotted-*)` and never targets `[data-ui]` or `[data-part]`.                                                                                                                                                                                                                                                                                                                                              | review, theme-app "Done" rule    |
| O6  | JSX contains no user-visible literal text; text comes from `useT()`.                                                                                                                                                                                                                                                                                                                                                                                                                       | `react/jsx-no-literals`          |
| O7  | Money travels as an integer plus an instrument code. Integer-text conversion is string manipulation with the instrument scale, never floating-point division.                                                                                                                                                                                                                                                                                                                              | Money type, tests of `format.ts` |
| O8  | `*.gen.*` files are never edited by hand.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | existing convention              |
| O9  | An amount is written through `useMoneyFormat()`, never through `formatMoney`, `formatMoneyParts`, `formatSigned` or `formatPlain` (ADR 018). Privacy mode masks it there.                                                                                                                                                                                                                                                                                                                  | ESLint `no-restricted-imports`   |
| O10 | A currency comes from the record or from settings, never from a literal fallback. A displayed number or date takes its format from the active tag through `Intl`. A regional value lives in the code of its region (the Brazilian bank catalogue, a `switch` on the region).                                                                                                                                                                                                               | review                           |
| O11 | App CSS never puts `clip-path`, `filter`, `mask`, `mix-blend-mode`, `opacity` below 1 or `will-change` of those on an ancestor of a blurred surface (a sticky header, a drawer, a toast, a Page footer, a tooltip). Each of them makes the element a backdrop root and ends the `backdrop-filter` of its descendants: the fill stays translucent and the text shows through unblurred. To round a clipped region use `border-radius` with `overflow`; to fade use the library's own state. | review                           |
| O12 | A part with `backdrop-filter` (a sticky header, a footer, a toast) inside a region with `overflow: hidden` and `border-radius` carries the region's inner radius on its own corners, through a `className` in a co-located `*.module.css`. The rounded overflow does not cut a blurred box: its square corners show over the region's border. The fix never removes the blur and never uses `clip-path` on the region (O11).                                                               | review                           |
| O13 | Text on a screen is drawn by a Slotted family or sits inside `Text` with a `size`. A bare `<a>`, a router `Link`, `<p>` or `<span>` in a section, a row or a card takes the browser's 16 px, larger than the 13 to 14 px of its neighbours. A link is the Slotted `Link` with `useAppLink`, inside `Text size="sm"` where no family sets the size.                                                                                                                                         | review                           |
| O14 | A child of a list item, card or section goes in a slot the family names (`ListItemBody`, `ListItemEnd`, `ListItemActions`). A bare child lands in an arbitrary grid cell and breaks the row. A warning that holds for every row is one `Alert` for the region, not one per row.                                                                                                                                                                                                            | review                           |

## Screens

These rules replace the Slotted guideline they name; the owner review of 2026-10-21 (`docs/superpowers/plans/2026-10-21-web-owner-review.md`) set them.

- **Page width (replaces CP-07).** Every destination, list, record and overview page is `full`; a create or edit form is `wide`; the login page is `content`. Moving between destinations never changes the page's measure.
- **Domain controls before families.** Money, a period, a month, a day and an account are what this application is about. Each has a control of the app's own (`ui/money-input`, `ui/period-control`, `ui/month-control`, `ui/date-shortcuts`, `transactions/account-field`); a screen that asks for one of them uses it, and a new screen that meets another such value builds its control under CP-04 rather than settling for a family's generic field.
- **Grids.** A data-grid is `variant="framed"`. An `actions` column is pinned at the end, and a grid holding buttons sets a `rowHeight` that leaves the cursor ring visible around them.
- **Grid props keep their identity.** Until Slotted fixes "Data-grid re-renders every row when messages or a renderer changes identity" and "A new tree object rebuilds every row of a data-grid", a data-grid's `messages`, `cellRenderers`, `editorRenderers`, `renderHeader`, `renderGroup`, `renderEmpty` and `tree` are module constants or memoised, and a handler a renderer calls goes through `useStableCallback`. A test selects a row, or opens a dialog over the grid, and asserts that no other row renders (`transactions-page.test.tsx`, "renders only the selected row when the selection changes").
- **A phone's list loads by the page's scroll.** Below 600 px a grid with `hasMore` follows `transactions-grid.tsx` until Slotted fixes "The data-grid's load-more fires until hasMore is false when the grid does not scroll": the grid gets no `hasMore`, and the page's scroller asks for the next page.
- **Measure on the production build.** A performance check runs on `make run-prod` at 390 px with the CPU throttled 4×; the development build of React costs about 4.5 times as much (one selection: 12 840 ms against 2 840 ms).
- **Phone screens.** Below 600 px a screen follows `../docs/contributing/mobile.md`: a table where the reader compares, `DataList` where the reader works on a record, the records before the figures, and tabs directly above their panel.
- **Headers.** A destination's header carries a subheading that says what the page is for, its period control when the page reads a period, and its primary action.
- **Writes refresh.** Every successful mutation marks all queries stale (`api/query-client.ts`); a screen never needs a reload to show the result of a write.
