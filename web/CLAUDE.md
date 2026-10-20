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
4. A workaround in `web/` carries a comment naming the finding by its title, so it can be removed when the library ships the fix.
5. When a new Slotted version is installed, check the findings of earlier tasks against it and remove each workaround the version makes unnecessary.

Template (one block per finding):

````markdown
### N. <short title: what is wrong or missing>

- **Kind:** bug | improvement | feature
- **Area:** family | token | utility | docs | guideline | agent — <family and part, token name, export, or file and section>
- **Problem:** <one or two sentences: the observed behaviour or the gap>
- **Evidence:** <screen and width, browser measurement, test name and timing, file and line in web/, or the agent step that went wrong>
- **Impact on equori:** <what the user sees or what the work cost>
- **Workaround:** <file in web/ and what it does, or "none">

```
<Kind> — <area and subject>.
<Observed/expected/repro, or need/proposed API/composition, or current text/replacement.>
Acceptance: <the test or check that fails before the change and passes after>.
```
````

## Rules

File names under `web/src` are kebab-case (O1). This is the only exception to the snake_case rule of Naming in the root `CLAUDE.md`.

The application sets `data-slotted-theme="equori"` and loads `@/theme/equori.gen.css` in place of the `default` theme and `@slotted/themes/default.css` of the Slotted UI section.

| ID  | Rule                                                                                                                                                          | Gate                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| O1  | One component per file; the file is named after the component in kebab-case.                                                                                  | ESLint `react/no-multi-comp`     |
| O2  | A feature imports another feature only through its `index.ts`.                                                                                                | ESLint `no-restricted-imports`   |
| O3  | `@/api/client` is imported only by `features/*/api.ts`, `features/session/**`, `app/providers.tsx`, `src/api/**` and `src/testing/**`.                        | ESLint override by glob          |
| O4  | `features/*` never imports `@/app/*`.                                                                                                                         | ESLint                           |
| O5  | App CSS lives in co-located `*.module.css` inside `@layer app`, reads only `var(--slotted-*)` and never targets `[data-ui]` or `[data-part]`.                 | review, theme-app "Done" rule    |
| O6  | JSX contains no user-visible literal text; text comes from `useT()`.                                                                                          | `react/jsx-no-literals`          |
| O7  | Money travels as an integer plus an instrument code. Integer-text conversion is string manipulation with the instrument scale, never floating-point division. | Money type, tests of `format.ts` |
| O8  | `*.gen.*` files are never edited by hand.                                                                                                                     | existing convention              |
