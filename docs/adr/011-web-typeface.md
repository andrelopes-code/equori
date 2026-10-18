# ADR 011: Web typeface

- Status: accepted
- Date: 2026-10-18

## Context

The Slotted default theme names `'Geist Variable'` in `--slotted-font-family-sans` and `'Geist Mono Variable'` in `--slotted-font-family-mono`, and ships no font file. Without the files every browser falls back to its system face, so the interface differs per platform and the tabular figures of the ledger sheet (`docs/superpowers/specs/2026-10-18-web-ledger-sheet-design.md`, L2) depend on that face. ADR 008-web-interface serves the application under `default-src 'self'`, so a font cannot load from a third-party origin.

## Decision

`web/package.json` adds two dependencies, pinned to exact versions:

| Package | Version | License | Purpose |
|---|---|---|---|
| `@fontsource-variable/geist` | 5.3.0 | OFL-1.1 | `'Geist Variable'`, weights 100–900 |
| `@fontsource-variable/geist-mono` | 5.3.0 | OFL-1.1 | `'Geist Mono Variable'`, weights 100–900 |

`web/src/main.tsx` imports both package stylesheets once, before the theme stylesheet. Vite copies the `woff2` files into the build, and `web/embed.go` embeds them in the binary.

## Consequences

- The binary grows by the `woff2` files of every subset of both packages, 164 kB for the upright styles. Each `@font-face` carries a `unicode-range`, so a browser downloads only the subsets its text uses.
- The theme keeps the family names of the default theme; no theme token changes.
- A font update is a version bump of these packages.
