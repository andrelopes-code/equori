# ADR 010: Web UI stack

- Status: accepted
- Date: 2026-10-17

## Context

The web interface needs a component library, client-side routing, server-state caching, charts, and a component test environment. ADR 028 fixes the delivery model: a Vite, React and TypeScript single-page application embedded in the binary.

## Decision

| ID | Decision |
|---|---|
| K1 | Slotted `0.1.0-beta.2`, pinned exactly. The `beta` npm tag lags at `beta.0`. |
| K2 | `@tanstack/react-router`: code-based routes; typed search params through `validateSearch`. |
| K3 | `@tanstack/react-query`: cache per resource; `useInfiniteQuery` over `next_cursor`; one query-key factory per feature. |
| K4 | Forms use local state with one reducer per form. No form library. |
| K5 | Tests: Vitest, `@testing-library/react`, a DOM environment (jsdom). API calls are faked through the `fetchImpl` parameter of `newClient`. No MSW; no mocks of internal modules. |
| K6 | ESLint adds `eslint-plugin-react` (for `react/jsx-no-literals`) and `eslint-plugin-react-hooks`. |

Dependencies added to `web/package.json`, pinned to exact versions:

| Package | Version | Kind | Purpose |
|---|---|---|---|
| `@slotted/react` | 0.1.0-beta.2 | dependency | Components |
| `@slotted/core` | 0.1.0-beta.2 | dependency | Peer of `@slotted/react` |
| `@slotted/theme` | 0.1.0-beta.2 | dependency | `slotted-build-theme` and `@slotted/theme/conformance` |
| `@slotted/themes` | 0.1.0-beta.2 | dependency | Default theme |
| `echarts` | 6.1.0 | dependency | Charts; peer of `@slotted/core` |
| `@tanstack/react-router` | 1.170.41 | dependency | Routing |
| `@tanstack/react-query` | 5.104.1 | dependency | Server state |
| `@testing-library/react` | 16.3.3 | devDependency | Component rendering in tests |
| `@testing-library/dom` | 10.4.2 | devDependency | Queries, peer of `@testing-library/react` |
| `@testing-library/user-event` | 14.6.7 | devDependency | User interaction in tests |
| `@testing-library/jest-dom` | 7.0.1 | devDependency | DOM matchers |
| `jsdom` | 30.1.1 | devDependency | DOM environment |
| `eslint-plugin-react` | 7.37.5 | devDependency | `react/jsx-no-literals` |
| `eslint-plugin-react-hooks` | 7.1.1 | devDependency | Rules of hooks |

`web/pnpm-workspace.yaml` carries two settings:

- `peerDependencyRules.allowedVersions` maps `eslint-plugin-react>eslint` to `10`. `eslint-plugin-react@7.37.5` declares its `eslint` peer range up to `^9.7`, and the project uses ESLint 10.12.0.
- `minimumReleaseAgeExclude` lists the four `@slotted/*` packages at `0.1.0-beta.2`. `0.1.0-beta.2` was published on 2026-10-17, younger than the minimum release age of pnpm 12.14.0.

Test environment: `web/src/testing/setup.ts` runs before each test file. It registers `@testing-library/jest-dom/vitest`, calls `setViewport(1280)` before each test and `cleanup` after each test. `setViewport(width)` in `@/testing/viewport` sets `window.innerWidth`, installs `window.matchMedia` evaluating `(min-width: Npx)` and `(max-width: Npx)` against the width, and dispatches `change` on every listener whose result changed.

## Consequences

- Slotted is a beta. Its API changes between betas without deprecation. An upgrade is a decision recorded as an amendment to this ADR.
- The CSP of ADR 028 (W12) applies to every dependency; a library that needs inline scripts or styles requires an amendment.
- `@slotted/react` 0.1.0-beta.2 bundles a CommonJS copy of `react-dom` in the chunk `dist/react-dom-*.js`. The chunk calls `require("react")`, which throws at module evaluation in the browser and leaves `#root` empty. A second `react-dom` copy would also not flush the application renderer. `web/vite.config.ts` registers the plugin `equori:slotted-react-dom`, which replaces the chunk with a re-export of the application's `react-dom`. The plugin is removed when Slotted ships an ESM `react-dom` import. `TestBuiltScriptsHaveNoCommonJSRequire` (`web/embed_test.go`) fails when a built script contains `typeof require`; it skips when `web/dist` holds no scripts.
