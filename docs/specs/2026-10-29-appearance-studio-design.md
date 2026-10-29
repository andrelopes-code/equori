# Appearance studio

Status: design, 2026-10-29; amended the same day (A7, A9, A11 to A18). Replaces the appearance pane (`web/src/features/setup/settings-appearance.tsx`) with a workspace of its own.

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
- New values: the four status seeds `success`, `danger`, `warning` and `info`. Money in reads the `success` tone and an overspent or negative figure the `danger` tone, so a reader controls their colours.

## Non-goals

- Synchronisation of themes through the server. Themes stay in the browser, as every appearance value does today (ADR 018, P1 sets the same pattern for privacy). A server store needs a migration, an API operation and an ADR; it is a later slice.
- A theme compiled in the browser. `applyTheme` writes a `<style>` element, which the policy `default-src 'self'` (ADR 028) refuses, and `@slotted/theme` adds 157 kB of minified script to the bundle.
- Free CSS in a theme.

## Anti-goals

- A combination that breaks contrast. Every colour a theme holds is a seed; the recipe's bounds keep the contrast floor of every scheme (`theme-app` skill, section 1).
- An imported file that injects markup or CSS. Import is a trust boundary (A6).

## Rules

| ID  | Rule |
| --- | ---- |
| A1  | A theme holds `accent`, `tone`, `success`, `danger`, `warning`, `info`, `corners`, `typeface`, `visual` and the surface values of A11. Scheme, density, text size, motion and the contrast of secondary text are reading preferences and stay outside every theme: applying a theme never changes them. |
| A2  | A status seed is `theme` (the compiled theme's own seed) or a `#rrggbb` hex. It is a preference under `equori.success`, `equori.danger`, `equori.warning`, `equori.info`, painted with `seedStyle` on the root, removed when `theme`. |
| A3  | Curated themes, with their values in `web/src/theme/themes.ts`: `equori` (every default), `ledger`, `paper`, `forest`, `ocean`, `dusk`, `terminal`, `glass`. Their names and one-line descriptions come from the catalogue (`theme.<id>`, `theme.<id>.description`). |
| A4  | The active theme is derived, never stored: the first theme, curated then saved, whose values equal the current values after resolving presets to their hex seeds. No match reads as "Custom". |
| A5  | Saved themes live under `equori.themes` as a JSON array of `{ id, name, ...values }`. A name is 1 to 40 characters after trimming. At most 50 saved themes. A malformed entry is dropped on read. |
| A6  | The export format is `{ "format": "equori.theme", "version": 1, "name", ...values }`, with every colour written as hex. Import accepts at most 4096 characters, parses JSON, checks `format` and `version`, validates each value with the check its preference uses, and refuses the whole file on the first invalid value with one message. Unknown fields are ignored. The name is rendered as text. |
| A7  | The studio is the route `/appearance`, outside the settings layout, at the full width of the main region. A top bar holds the way back to settings, the active theme and its actions. A control panel of 26 rem sits at the start edge with the tabs Themes, Colour, Surfaces, Shape, Text and Effects. The canvas fills the rest with a live drawing of the application and switches for scheme and device. Under 60 rem of viewport width the canvas sits above the panel. The settings section `appearance` links to the route. |
| A8  | The gallery is a radio group named "Theme". The header's actions act on the active theme: save as a new theme, import, export; rename and delete when the active theme is a saved one. Delete asks for confirmation. |
| A9  | Every control keeps its storage key. The tests of `settings-page.test.tsx` that drive appearance controls move to the studio's test with the same assertions on stored values and root attributes. |
| A10 | Every amount in the preview goes through `useMoneyFormat()` with the profile's base currency (O9, O10). |
| A11 | Surface values: `depth` (`soft`, `standard`, `deep`, `oled`), `step` (`standard`, `wide`), `borders` (`none`, `subtle`, `strong`), `shadows` (`flat`, `soft`, `deep`), `chart` (`spectrum`, `accent`, `mono`). Each is a preference under `equori.<name>`, always written on the root as `data-equori-<name>`, the default included. |
| A12 | The reading preference `contrast` (`standard`, `high`) lifts secondary text. It is stored under `equori.contrast` and written as `data-equori-contrast`. |
| A13 | `web/src/theme/surface-recipe.ts` holds each value of A11 and A12 as Slotted derivations per scheme, `dark` and `light`. `high-contrast` keeps the compiled theme. `make gen` writes one stylesheet from them with `derivationCss` to `surface.gen.css`, which the application loads beside the compiled theme; only the root attributes change. |
| A14 | An element that carries `data-equori-<name>` takes that value for itself and for the scheme scopes under it that carry none, so a theme card or the canvas draws its own surfaces. |
| A15 | `themeConformance` passes for the compiled theme extended with every value of A11 and A12, one at a time and with `depth` × `step`. |
| A16 | A theme file of version 1 without a surface value reads that value's default. Export writes every surface value. |
| A17 | Undo restores the values held before the last change made in the studio, up to 50 steps, for the page load. |
| A18 | The accent and the neutral tone are picked by hue and chroma sliders over OKLCH, written as `#rrggbb`; the presets stay as swatches. |

## Curated themes

Hex seeds; `—` keeps the compiled theme's seed.

| ID         | accent    | tone      | success   | danger    | corners  | typeface  | visual   | depth    | borders | shadows |
| ---------- | --------- | --------- | --------- | --------- | -------- | --------- | -------- | -------- | ------- | ------- |
| `equori`   | indigo    | graphite  | —         | —         | standard | geist     | standard | standard | subtle  | soft |
| `ledger`   | `#3d6fd9` | zinc      | `#2f9e5f` | `#d64545` | square   | grotesque | standard | standard | strong  | flat |
| `paper`    | `#b4532a` | stone     | `#5f8a3a` | `#c2410c` | soft     | humanist  | standard | soft     | subtle  | soft |
| `forest`   | `#2f9e6e` | sage      | `#65a30d` | `#e0565b` | standard | geist     | standard | standard | subtle  | soft |
| `ocean`    | cyan      | slate     | `#14b8a6` | `#f97066` | round    | grotesque | standard | deep     | none    | deep |
| `dusk`     | pink      | `#7a6a86` | `#34d399` | `#fb7185` | round    | rounded   | standard | deep     | none    | soft |
| `terminal` | `#f59e0b` | zinc      | `#22c55e` | `#ef4444` | square   | mono      | standard | oled     | strong  | flat |
| `glass`    | violet    | graphite  | —         | —         | round    | geist     | glass    | standard | subtle  | soft |

`warning` and `info` stay `theme`, `step` stays `standard` and `chart` stays `spectrum` in every curated theme.

## Region

No value of this design depends on a region. The colour of money in and of an overspent figure remains the compiled theme's `success` and `danger` seeds; a reader overrides them through A2. A regional default for those colours is outside this design.

## Left to the builder

- The exact composition of the miniature and of the live preview, within O5 and O13.
- The family used for each action (menu, dialog, segmented control), read from `node_modules/@slotted/react/dist/docs/`.
- The split of the pane into component files under the size limits of the code layout rules.
