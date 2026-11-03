# ADR 032: Tailwind utilities for spacing

- Status: accepted
- Date: 2026-11-03

## Context

`docs/contributing/web.md` (O5) allowed app CSS only in a co-located `*.module.css`. A one-property tweak on one element, such as a margin of `--slotted-space-2` at the inline start, cost a new file and a class name. Slotted draws the components and owns the tokens; it has no utility classes.

## Decision

- `tailwindcss` and `@tailwindcss/vite` 4.3.3 enter `devDependencies` of `web/`. Both run at build time; no Tailwind code ships to the browser.
- `src/app/tailwind.css` imports only `tailwindcss/utilities.css`, into the cascade layer `utilities`. `src/app/app.css` declares the order `@layer slotted, app, utilities;`, so a utility overrides app CSS and the library.
- The stylesheet imports neither the preflight nor the default theme. The library's reset stands, and the Tailwind palette, type scale, radius scale and spacing multiple do not exist.
- `@theme inline` maps the spacing keys `0` and `1` to `12` to `0` and `--slotted-space-1` to `--slotted-space-12`. The number of a spacing utility is the Slotted token: `ms-2` is `--slotted-space-2`, where Tailwind's `ms-2` is 0.5rem. A step outside the scale emits no rule.
- A utility goes on an element the app draws or on the root of a family, through `className`. It never targets a part of a family.
- A theme key for another namespace (colour, radius, font) enters `tailwind.css` only as a mapping to a `--slotted-*` token, in a change that amends O5.

## Consequences

- Two dev dependencies and one Vite plugin enter the build.
- `src/app/tailwind.test.ts` compiles `tailwind.css` and fails when a spacing key stops resolving to its token, when a palette or out-of-scale class emits a rule, or when a base layer appears.
- Tailwind accepts an arbitrary value (`mt-[13px]`). `src/testing/tailwind-source.test.ts` fails when a `className` literal in `src/` holds one.
- The margin and padding file `src/app/utilities.css` of commit `512ea7ab` is removed; this decision replaces it.
