# Appearance studio

Status: design, 2026-10-29. Replaces the layout of the appearance pane (`web/src/features/setup/settings-appearance.tsx`).

## Intent

Visual quality is a core property of equori, and the appearance pane is where a reader shapes it. The current pane is a vertical form: nine independent controls of equal weight, schematic previews, and no notion of a theme. A reader cannot name, keep, share or restore a look, and sees the result of a control only outside the pane.

The appearance studio makes the theme the primary decision and the individual controls a refinement of it.

## Goals

- A theme is a named set of appearance values. Applying a theme writes every value it holds in one step.
- The application ships eight curated themes (A3). Each one is a coherent combination of hue, neutral tone, status colours, corners, typeface and surface style.
- A reader saves the current values as a theme, renames, duplicates and deletes saved themes.
- A reader exports a theme as JSON (clipboard and file) and imports one (paste and file).
- Every theme card draws a miniature of the application with real Slotted components under its own `ThemeScope`, not a schematic.
- The fine-tuning editor sits beside a live preview of real components: an account figure, a budget meter, transactions with income and expense amounts, a tag, a field and the button variants.
- New values: the four status seeds `success`, `danger`, `warning` and `info`. Income and expense amounts read the `success` and `danger` tones, so a reader controls their colours.

## Non-goals

- Synchronisation of themes through the server. Themes stay in the browser, as every appearance value does today (ADR 018, P1 sets the same pattern for privacy). A server store needs a migration, an API operation and an ADR; it is a later slice.
- A theme with its own recipe (grounds, layer steps). The recipe is compiled; runtime themes change seeds and attributes only.
- Free CSS in a theme.

## Anti-goals

- A combination that breaks contrast. Every colour a theme holds is a seed; the recipe's bounds keep the contrast floor of every scheme (`theme-app` skill, section 1).
- An imported file that injects markup or CSS. Import is a trust boundary (A6).

## Rules

| ID  | Rule |
| --- | ---- |
| A1  | A theme holds `accent`, `tone`, `success`, `danger`, `warning`, `info`, `corners`, `typeface` and `visual`. Scheme, density, text size and motion are reading preferences and stay outside every theme: applying a theme never changes them. |
| A2  | A status seed is `theme` (the compiled theme's own seed) or a `#rrggbb` hex. It is a preference under `equori.success`, `equori.danger`, `equori.warning`, `equori.info`, painted with `seedStyle` on the root, removed when `theme`. |
| A3  | Curated themes, with their values in `web/src/theme/themes.ts`: `equori` (every default), `ledger`, `paper`, `forest`, `ocean`, `dusk`, `terminal`, `glass`. Their names and one-line descriptions come from the catalogue (`theme.<id>`, `theme.<id>.description`). |
| A4  | The active theme is derived, never stored: the first theme, curated then saved, whose values equal the current values after resolving presets to their hex seeds. No match reads as "Custom". |
| A5  | Saved themes live under `equori.themes` as a JSON array of `{ id, name, ...values }`. A name is 1 to 40 characters after trimming. At most 50 saved themes. A malformed entry is dropped on read. |
| A6  | The export format is `{ "format": "equori.theme", "version": 1, "name", ...values }`, with every colour written as hex. Import accepts at most 4096 characters, parses JSON, checks `format` and `version`, validates each value with the check its preference uses, and refuses the whole file on the first invalid value with one message. Unknown fields are ignored. The name is rendered as text. |
| A7  | The pane reads top to bottom: header with the active theme and its actions; the scheme as a segmented control; the theme gallery; the fine-tuning editor beside the live preview. Under 48 rem of the pane's own width the preview sits above the editor. |
| A8  | The gallery is a radio group named "Theme". A saved theme's card carries a menu: rename, duplicate, export, delete. Delete asks for confirmation. |
| A9  | The controls keep their accessible names and storage keys, so `settings-page.test.tsx` keeps passing unchanged. |
| A10 | Every amount in the preview goes through `useMoneyFormat()` with the profile's base currency (O9, O10). |

## Curated themes

Hex seeds; `—` keeps the compiled theme's seed.

| ID         | accent    | tone      | success   | danger    | corners  | typeface  | visual   |
| ---------- | --------- | --------- | --------- | --------- | -------- | --------- | -------- |
| `equori`   | indigo    | graphite  | —         | —         | standard | geist     | standard |
| `ledger`   | `#3d6fd9` | zinc      | `#2f9e5f` | `#d64545` | square   | grotesque | standard |
| `paper`    | `#b4532a` | stone     | `#5f8a3a` | `#c2410c` | soft     | humanist  | standard |
| `forest`   | `#2f9e6e` | sage      | `#65a30d` | `#e0565b` | standard | geist     | standard |
| `ocean`    | cyan      | slate     | `#14b8a6` | `#f97066` | round    | grotesque | standard |
| `dusk`     | pink      | `#7a6a86` | `#34d399` | `#fb7185` | round    | rounded   | standard |
| `terminal` | `#f59e0b` | zinc      | `#22c55e` | `#ef4444` | square   | mono      | standard |
| `glass`    | violet    | graphite  | —         | —         | round    | geist     | glass    |

`warning` and `info` stay `theme` in every curated theme.

## Region

No value of this design depends on a region. The colour of income and of expense remains the compiled theme's `success` and `danger` seeds; a reader overrides them through A2. A regional default for those colours is outside this design.

## Left to the builder

- The exact composition of the miniature and of the live preview, within O5 and O13.
- The family used for each action (menu, dialog, segmented control), read from `node_modules/@slotted/react/dist/docs/`.
- The split of the pane into component files under the size limits of the code layout rules.
