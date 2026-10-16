# Web foundation: design

- Date: 2026-10-16
- Branch: `feat/web-foundation`

## Intent

The web interface is the only client of equori (`docs/domain/01-vision.md:176`: no native mobile apps). This work sets up the toolchain, the build and the delivery of `web/` before any screen exists. The first screen then starts on a base where types, lint, tests and embedding already run in `make check`.

## Goals

- `web/` holds a single-page application (SPA): one `index.html` that loads the JavaScript bundle; the browser resolves routes, the server returns the same document for every non-API path.
- TypeScript types of the HTTP contract are generated from `api/openapi.yaml`, the same source as the Go server types.
- `go build` produces one binary that serves the API and the SPA.
- `make check` fails on a type error, a lint error, a failing test, a failing build or stale generated types in `web/`.
- The container image builds the SPA and embeds it.

## Non-goals

- Pages, routes, screens, forms or any user flow.
- Styling: no CSS framework, no component library, no design tokens, no CSS file beyond what Vite requires to build.
- Routing, server-state and i18n libraries (TanStack Router, TanStack Query, an i18n library). They enter with the first page that consumes them.
- Responsiveness requirements. They are written as an N requirement before the first page.

## Anti-goals

- A Node.js process at runtime. The container keeps one process: the Go binary (`CLAUDE.md`: single binary, single container).
- A dependency without a consumer in this branch.
- A Go build or Go test that requires Node.js. `go build ./...` and `go test ./...` pass on a checkout without `web/node_modules`.

## Decisions

| ID | Decision | Made by |
|---|---|---|
| W1 | SPA built with Vite, React and TypeScript. Next.js is excluded: embedding requires `output: 'export'`, which removes Server Components rendered per request, Server Actions, middleware and route handlers, and requires every dynamic route to be known at build time. | Claude, delegated by the user |
| W2 | TypeScript compiler options include `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. | Claude |
| W3 | Package manager: pnpm, version pinned in the `packageManager` field of `web/package.json`, activated through Corepack. Node.js version pinned in `web/.node-version`. Every dependency is pinned to an exact version; `web/pnpm-lock.yaml` is committed. | Claude |
| W4 | API types: `openapi-typescript` generates `web/src/api/schema.gen.ts` from `api/openapi.yaml`. `make gen` runs it. `make gen-check` covers `*.gen.ts` as it covers `*.gen.go`. | Claude |
| W5 | API client: `openapi-fetch` typed by `schema.gen.ts`, base URL `/api/v1`, same origin. The session cookie travels with the default `credentials: 'same-origin'`; the client stores no token (ADR 003). No call site exists in this branch. | Claude |
| W6 | Lint: ESLint flat config with `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked`. Format: Prettier. `eslint-plugin-react-hooks` enters with the first component that uses a hook. | Claude |
| W7 | Tests: Vitest in the `node` environment. Testing Library and jsdom enter with the first page test. | Claude |
| W8 | Embedding: a Go package at `web/` (`web/embed.go`) embeds `web/dist` with `//go:embed all:dist`. `web/dist/.gitkeep` is committed so the directive compiles without a Node build (`.gitignore` already excludes the rest of `web/dist`). | Claude |
| W9 | Serving: `internal/platform/spa` returns an `http.Handler` over an `fs.FS`. `cmd/equori` passes the embedded `web/dist`; `internal/apitest` passes a test file system. A path matching a file returns that file. Any other `GET` or `HEAD` path outside `/api/` and `/healthz` returns `index.html` with status 200. `/api/` paths keep the existing 404 problem (`httpserver.NotFound`). Any other method on a non-API path returns 405 with `Allow: GET, HEAD`, following C5 of ADR 007. | Claude |
| W10 | When the embedded file system has no `index.html` (Go build without a Node build), non-API paths return 404. The API is unaffected. | Claude |
| W11 | Caching: files under `assets/` (Vite content-hashed names) return `Cache-Control: public, max-age=31536000, immutable`. `index.html` returns `Cache-Control: no-cache`. | Claude |
| W12 | Security headers on non-API responses: `Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`, in addition to the C9 headers of ADR 007. | Claude |
| W13 | Development: `make web-dev` runs the Vite dev server, which proxies `/api` to `127.0.0.1:8080` (`make dev`). The browser sees one origin, so the session cookie works without CORS. | Claude |
| W14 | `make check` adds a `web-check` target: `pnpm install --frozen-lockfile`, typecheck (`tsc --noEmit`), ESLint, Prettier check, Vitest, `vite build`. | Claude |
| W15 | CI: `.github/workflows/ci.yml` sets up Node.js from `web/.node-version` and enables Corepack before `make check`. | Claude |
| W16 | Container: the `Dockerfile` gains a Node.js stage that runs `pnpm install --frozen-lockfile` and `pnpm build`; the Go stage copies its `web/dist` before `go build`. The Node stage runs on `$BUILDPLATFORM`; its output is architecture-independent. | Claude |
| W17 | ADR 008 records W1, W8, W9, W11 and W12. `docs/domain/09-roadmap.md:42` cites ADR 008 in place of ADR 002. `CLAUDE.md` and `README.md` list the new commands and the `web/` layout. | Claude |

## Contents of `web/` in this branch

- `index.html`, `src/main.tsx` mounting a root component that renders nothing visible.
- `src/api/schema.gen.ts` (generated) and `src/api/client.ts` (W5).
- Configuration: `package.json`, `pnpm-lock.yaml`, `.node-version`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `vitest` configuration.
- `embed.go`, `dist/.gitkeep`.

## Verification

| Behavior | Test |
|---|---|
| W9: a file path returns the file | Go test of `internal/platform/spa` over `fstest.MapFS` |
| W9: an unknown non-API path returns `index.html` with 200 | Same |
| W9: an unknown `/api/` path returns the 404 problem | `internal/apitest` |
| W9: `POST` on a non-API path returns 405 with `Allow: GET, HEAD` | Go test of `internal/platform/spa` |
| W10: no `index.html` returns 404 | Go test of `internal/platform/spa` |
| W11: cache headers per file kind | Go test of `internal/platform/spa` |
| W12: CSP on non-API responses, API CSP unchanged | Extension of `internal/platform/httpserver/middleware_test.go` |
| W5: client base URL `/api/v1` and same-origin credentials | Vitest test over a stubbed `fetch` |
| W4: stale generated types fail `make check` | `make gen-check` run after editing `api/openapi.yaml` without `make gen` |
| W14, W16 | `make check` and `docker build .` pass |

## Left to the builder

- Exact versions of Node.js, pnpm and every package: latest stable release at implementation time.
- `http.ServeMux` pattern for the SPA handler. `GET /` and `/api/` overlap without either being more specific, which makes `ServeMux` panic at registration; a method-less `/` pattern with a method check inside the handler avoids the conflict.
- Whether `internal/server.Config` carries the `fs.FS` or `server.New` takes it as a parameter.
