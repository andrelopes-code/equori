# Web Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up `web/` as a Vite + React + strict TypeScript SPA, embedded in and served by the Go binary, checked by `make check`, CI and the container build, with no page and no styling.

**Architecture:** A Go package at `web/` embeds `web/dist`. `internal/platform/spa` serves it as an `http.Handler` registered on `/` in `internal/server`, outside `/api/`. TypeScript API types are generated from `api/openapi.yaml` into `web/src/api/schema.gen.ts` by `make gen`.

**Tech Stack:** Go 1.27 `embed`, `net/http`; Node.js 24.15.0, pnpm 12.14.0 (Corepack), Vite 8.3.4, React 19.3.1, TypeScript 5.9.3, ESLint 10.13.0 + typescript-eslint 8.71.2, Prettier 3.9.10, openapi-typescript 7.13.0, openapi-fetch 0.17.0, Vitest 5.0.5.

**Spec:** `docs/superpowers/specs/2026-10-16-web-foundation-design.md` (decisions W1–W17).

## Global Constraints

- Every npm dependency is pinned to an exact version (no `^`, no `~`); `web/pnpm-lock.yaml` is committed.
- TypeScript stays on 5.9.3: `typescript-eslint` 8.71.2 declares the peer range `>=4.8.4 <6.1.0` and `openapi-typescript` 7.13.0 declares `^5.x`.
- A dependency enters in the task that first uses it. No Testing Library, jsdom, `eslint-plugin-react-hooks`, router, query or i18n library in this plan.
- No CSS, no style attribute, no class name, no CSS dependency.
- `go build ./...` and `go test ./...` pass without `web/node_modules` and without a Vite build.
- Generated files end in `.gen.ts` or `.gen.go` and are never edited by hand.
- File names are lowercase snake_case (`CLAUDE.md`, Naming).
- In this worktree, Postgres of the main checkout occupies `127.0.0.1:54329`. Every `make` target that starts Postgres runs with `EQUORI_DEV_DB_PORT=54330`.
- Commits follow `CLAUDE.md`, Commits. No AI attribution.
- Execution runs in slices of at most three tasks; each slice ends by writing `.claude/progress/current.md` (user `CLAUDE.md`, Execution slice protocol).

## Review Focus

1. A missing file under `/assets/` (a stale hashed name after a deploy) returns 404, not `index.html`; HTML served as JavaScript breaks the page with a MIME error. Test: Task 1, row `missing asset`.
2. `GET /index.html` returns the document with 200, not a redirect to `/` (`http.ServeFileFS` redirects it). Test: Task 1, row `index by name`.
3. A directory path never returns a listing. Test: Task 1, row `asset directory`.
4. A path with `..` segments never reads outside the embedded tree. Test: Task 1, row `dot-dot path`.
5. `vite build` leaves `web/dist/.gitkeep` in place, so the working tree stays clean after `make check`. Verification: Task 3, Step 7.

---

### Task 1: SPA handler

**Files:**
- Create: `internal/platform/spa/spa.go`
- Test: `internal/platform/spa/spa_test.go`

**Interfaces:**
- Produces: `func Handler(fsys fs.FS) http.Handler` in package `spa`. A nil `fsys` behaves as a tree without `index.html`.

- [ ] **Step 1: Write the failing test `TestHandler`**

Table-driven over this tree:

```go
fsys := fstest.MapFS{
	"index.html":         {Data: []byte("<!doctype html><div id=\"root\"></div>")},
	"assets/app-1a2b.js": {Data: []byte("console.log(1)")},
	"favicon.svg":        {Data: []byte("<svg/>")},
}
```

| Row | Method | Path | Status | Body | `Cache-Control` | `Allow` |
|---|---|---|---|---|---|---|
| root | GET | `/` | 200 | index | `no-cache` | |
| client route | GET | `/accounts/42` | 200 | index | `no-cache` | |
| index by name | GET | `/index.html` | 200 | index | `no-cache` | |
| asset | GET | `/assets/app-1a2b.js` | 200 | `console.log(1)` | `public, max-age=31536000, immutable` | |
| root file | GET | `/favicon.svg` | 200 | `<svg/>` | (absent) | |
| missing asset | GET | `/assets/app-9z9z.js` | 404 | | | |
| asset directory | GET | `/assets/` | 404 | | | |
| dot-dot path | GET | `/../../etc/passwd` | 200 | index | `no-cache` | |
| head | HEAD | `/accounts` | 200 | (empty) | `no-cache` | |
| post | POST | `/accounts` | 405 | | | `GET, HEAD` |

Assert the asset row's `Content-Type` is `text/javascript; charset=utf-8`. A second test, `TestHandlerWithoutIndex`, asserts 404 for `GET /` and `GET /accounts` with `fstest.MapFS{}` and with `nil`.

- [ ] **Step 2: Run and read the failure**

Run: `go test ./internal/platform/spa/`
Expected: FAIL, `undefined: Handler`.

- [ ] **Step 3: Implement `Handler` in `internal/platform/spa/spa.go`**

Resolve the cleaned path (`path.Clean`, leading `/` removed) against `fsys`. A regular file is served with `http.ServeContent`; anything else under `assets/` is 404; anything else is `index.html`. Serving `index.html` through `http.ServeContent` avoids the redirect `http.ServeFileFS` applies to that name. Package comment: one line.

- [ ] **Step 4: Run the test**

Run: `go test -race ./internal/platform/spa/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/platform/spa
git commit -m "feat(platform): serve a single-page application from a file system"
```

---

### Task 2: Serve the embedded SPA and record ADR 008

**Files:**
- Create: `web/embed.go`, `web/dist/.gitkeep` (empty), `internal/server/web_test.go`, `docs/adr/008-web-interface.md`
- Delete: `web/.gitkeep`
- Modify: `internal/server/server.go` (`Config`, route registration), `internal/apitest/apitest.go` (new option), `cmd/equori/main.go:72`, `internal/platform/httpserver/middleware.go` (`securityHeaders`), `internal/platform/httpserver/middleware_test.go` (`TestMiddlewareSetsSecurityHeaders`), `docs/domain/09-roadmap.md:42`

**Interfaces:**
- Consumes: `spa.Handler(fsys fs.FS) http.Handler` (Task 1).
- Produces: `func Dist() fs.FS` in package `web` (module path `github.com/andrelopes-code/equori/web`), the `dist` subtree of `//go:embed all:dist`. Field `Web fs.FS` on `server.Config`. `func Web(fsys fs.FS) Option` in `apitest`.

- [ ] **Step 1: Write the failing tests**

`internal/server/web_test.go`, `TestWebIsServedOutsideAPI`, through `apitest.New(t, apitest.Web(fstest.MapFS{"index.html": ...}))`:
- `h.Do(GET, "/accounts", nil)`: status 200, body equal to the index data, `Content-Security-Policy` equal to `default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`.
- `h.Do(GET, "/api/v1/nope", nil)`: `h.ExpectProblem(..., 404, "not_found", "")`.

`TestMiddlewareSetsSecurityHeaders`: the `non-api` row now expects the CSP above and no `Cache-Control`; API rows keep `default-src 'none'; frame-ancestors 'none'`.

- [ ] **Step 2: Run and read the failures**

Run: `EQUORI_DEV_DB_PORT=54330 make db-up && EQUORI_TEST_DATABASE_URL='postgres://equori:equori@127.0.0.1:54330/postgres?sslmode=disable' go test ./internal/server/ ./internal/platform/httpserver/ -run 'TestWebIsServedOutsideAPI|TestMiddlewareSetsSecurityHeaders'`
Expected: FAIL; `undefined: apitest.Web` first, then the CSP mismatch.

- [ ] **Step 3: Implement**

- `web/embed.go`: package comment one line; `Dist` panics only on an `fs.Sub` error, which a constant valid directory name cannot produce.
- `server.New`: `mux.Handle("/", spa.Handler(cfg.Web))`. A method-less pattern: `GET /` conflicts with `/api/` and makes `ServeMux` panic.
- `cmd/equori/main.go:72`: `Web: web.Dist()`. The `rebuild` command at `main.go:106` serves no HTTP and keeps `server.Config{}`.
- `securityHeaders`: non-API responses get the CSP above.

- [ ] **Step 4: Run the tests**

Run: the command of Step 2.
Expected: PASS.

- [ ] **Step 5: Write ADR 008 and update the roadmap**

`docs/adr/008-web-interface.md` in the format of ADR 007 (Status accepted, Date 2026-10-16, Context, Decision table, Consequences). Decision rows: W1, W8, W9 (with the 405 rule), W10, W11, W12. `docs/domain/09-roadmap.md:42`: `(ADR 002)` becomes `(ADR 008)`.

- [ ] **Step 6: Verify the slice**

Run: `EQUORI_DEV_DB_PORT=54330 make check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add web/embed.go web/dist/.gitkeep web/.gitkeep internal cmd docs/adr/008-web-interface.md docs/domain/09-roadmap.md
git commit -m "feat(platform): embed and serve the web interface"
```

Body names W12 of the spec as the reason `TestMiddlewareSetsSecurityHeaders` changed.

---

### Task 3: Vite, React and TypeScript toolchain

**Files:**
- Create: `web/package.json`, `web/pnpm-lock.yaml`, `web/.node-version`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/app.tsx`, `web/eslint.config.js`, `web/.prettierrc.json`, `web/.prettierignore`
- Modify: `Makefile`, `CLAUDE.md` (Commands, Layout), `README.md` (Development)

**Interfaces:**
- Produces: Makefile targets `web-deps` (stamp `web/node_modules/.installed`, rebuilt when `web/package.json` or `web/pnpm-lock.yaml` changes), `web-build`, `web-check`, `web-dev`. `package.json` scripts `dev`, `build`, `typecheck`, `lint`, `format:check`. `export function App(): null` in `web/src/app.tsx`.

- [ ] **Step 1: Create the package**

`package.json`: `"private": true`, `"type": "module"`, `"packageManager": "pnpm@12.14.0"`. Dependencies: `react` and `react-dom` 19.3.1. Dev dependencies: `vite` 8.3.4, `@vitejs/plugin-react` 6.1.2, `typescript` 5.9.3, `@types/react` and `@types/react-dom` 19.3.0, `eslint` 10.13.0, `@eslint/js` 10.0.1, `typescript-eslint` 8.71.2, `prettier` 3.9.10. `.node-version`: `24.15.0`. Run `corepack enable` once, then `pnpm --dir web install` to write the lockfile.

- [ ] **Step 2: Configure TypeScript, Vite, ESLint and Prettier**

- `tsconfig.json`: options of W2, plus `"noEmit": true`, `"jsx": "react-jsx"`, `"moduleResolution": "bundler"`, `"module": "ESNext"`, `"target": "ES2022"`, `"lib": ["ES2022", "DOM", "DOM.Iterable"]`; includes `src` and `vite.config.ts`.
- `vite.config.ts`: React plugin; `server.proxy` sends `/api` to `http://127.0.0.1:8080`; `build.emptyOutDir: false` (Step 5 cleans `dist`, keeping `.gitkeep`).
- `eslint.config.js`: `@eslint/js` recommended, `tseslint.configs.strictTypeChecked` and `stylisticTypeChecked` with `parserOptions.projectService: true`; `tseslint.configs.disableTypeChecked` for `**/*.js`; ignores `dist` and `**/*.gen.ts`.
- `.prettierignore`: `dist`, `pnpm-lock.yaml`, `**/*.gen.ts`.

- [ ] **Step 3: Write the entry point**

`index.html` holds `<div id="root"></div>` and loads `/src/main.tsx`. `main.tsx` mounts `<App />` with `createRoot` in `StrictMode` and throws `Error("missing #root element")` when the element is absent (`no-non-null-assertion` forbids `!`). `App` returns `null`.

- [ ] **Step 4: Add the Makefile targets**

- `web-deps`: `pnpm --dir web install --frozen-lockfile`, then `touch web/node_modules/.installed`.
- `web-build` (depends on `web-deps`): `find web/dist -mindepth 1 ! -name .gitkeep -delete`, then `pnpm --dir web build`.
- `web-check` (depends on `web-deps`): `typecheck`, `lint`, `format:check`, then `web-build`.
- `web-dev` (depends on `web-deps`): `pnpm --dir web dev`.
- `check: fmt-check tidy-check gen-check lint web-check test`; `build` depends on `web-build`.

- [ ] **Step 5: Show that the checks catch errors**

Add `const n: number = "x";` to `app.tsx`; run `make web-check`; expected: FAIL with TS2322. Remove it. Add `export const a = 1 as any;`; expected: FAIL with `@typescript-eslint/no-explicit-any`. Remove it.

- [ ] **Step 6: Run the checks**

Run: `make web-check`
Expected: exit 0; `web/dist/index.html` and one `web/dist/assets/*.js` exist.

- [ ] **Step 7: Verify isolation from Go and a clean tree**

Run: `go list ./... | grep -c node_modules` → `0`. Run: `git status --short web/dist` → empty output (`.gitkeep` present, build output ignored).

- [ ] **Step 8: Update `CLAUDE.md` and `README.md`**

`CLAUDE.md`: Commands table rows for `make web-dev` and `make web-check`; `make check` row adds the web checks; Layout row `web/  SPA (Vite, React, TypeScript), embedded by web/embed.go`; replace "Frontend (`web/`) comes later and is embedded in the binary." with a reference to ADR 008; Commits section adds `web` to the allowed scopes. `README.md`: requirements add Node.js 24 with Corepack enabled; command block adds `make web-dev`.

- [ ] **Step 9: Verify and commit**

Run: `EQUORI_DEV_DB_PORT=54330 make check` → exit 0.

```bash
git add web Makefile CLAUDE.md README.md
git commit -m "build(web): add the vite, react and typescript toolchain"
```

---

### Task 4: API types and client

**Files:**
- Create: `web/src/api/schema.gen.ts` (generated), `web/src/api/client.ts`, `web/src/api/client_test.ts`
- Modify: `web/package.json`, `web/pnpm-lock.yaml`, `web/vite.config.ts` (Vitest `test.environment: "node"`), `Makefile` (`gen`, `gen-check`, `web-check`)

**Interfaces:**
- Consumes: `web-deps` (Task 3).
- Produces: `export function newClient(origin: string, fetchImpl?: typeof fetch): Client<paths>` in `web/src/api/client.ts`; `paths` from `schema.gen.ts`. No module-level client instance: the first page creates one with `window.location.origin`.

- [ ] **Step 1: Add dependencies and the test script**

`openapi-fetch` 0.17.0; dev: `openapi-typescript` 7.13.0, `vitest` 5.0.5. Script `"test": "vitest run"`.

- [ ] **Step 2: Generate the types**

`gen` depends on `web-deps` and adds `pnpm --dir web exec openapi-typescript ../api/openapi.yaml -o src/api/schema.gen.ts`. `gen-check` checks `'*.gen.go' '*.gen.ts'` in both `git diff` and `git ls-files`. Run `make gen`; `schema.gen.ts` contains the key `"/accounts"`.

- [ ] **Step 3: Write the failing test**

`client_test.ts`, test `sends requests under /api/v1 of the origin with same-origin credentials`: `newClient("https://equori.test", fake)` where `fake` records its `Request` argument and returns `new Response('{"items":[]}', {status: 200, headers: {"Content-Type": "application/json"}})`; after `await client.GET("/accounts")`, exactly one request was recorded, its `url` is `https://equori.test/api/v1/accounts` and its `credentials` is `same-origin`.

- [ ] **Step 4: Run and read the failure**

Run: `pnpm --dir web test`
Expected: FAIL, `newClient` not exported.

- [ ] **Step 5: Implement `newClient`**

`createClient<paths>({ baseUrl: origin + "/api/v1", credentials: "same-origin", fetch: fetchImpl })`; `fetchImpl` defaults to `globalThis.fetch`.

- [ ] **Step 6: Run the test, then add it to `web-check`**

Run: `pnpm --dir web test` → PASS. `web-check` runs `pnpm --dir web test` after `format:check`.

- [ ] **Step 7: Show that `gen-check` catches stale types**

Change the `summary` of one operation in `api/openapi.yaml` and run `make gen-check`. Expected: FAIL, `git diff` lists `web/src/api/schema.gen.ts`. Restore with `git checkout -- api/openapi.yaml web/src/api/schema.gen.ts` and any listed `*.gen.go`; `git status --short` shows no change outside this task's files.

- [ ] **Step 8: Verify and commit**

Run: `EQUORI_DEV_DB_PORT=54330 make check` → exit 0.

```bash
git add web Makefile
git commit -m "feat(web): generate api types and add the typed client"
```

---

### Task 5: CI and container image

**Files:**
- Modify: `.github/workflows/ci.yml`, `Dockerfile`, `.dockerignore`

**Interfaces:**
- Consumes: `web/.node-version`, `package.json` script `build`, `web/pnpm-lock.yaml` (Task 3).

- [ ] **Step 1: CI**

In job `check`, before `make check`: `actions/setup-node@v6` with `node-version-file: web/.node-version`, then `run: corepack enable`.

- [ ] **Step 2: Dockerfile**

New first stage `web`, `FROM --platform=$BUILDPLATFORM node:24.15.0-slim`, `WORKDIR /src/web`, `corepack enable`, copy `web/package.json` and `web/pnpm-lock.yaml`, `pnpm install --frozen-lockfile`, copy `web/`, `pnpm build`. In stage `build`, after `COPY . .`: `COPY --from=web /src/web/dist ./web/dist`. `.dockerignore` adds `web/dist`.

- [ ] **Step 3: Build the image**

Run: `docker build -t equori:web-foundation .`
Expected: exit 0.

- [ ] **Step 4: Verify the served document**

Run `make web-build`, then `EQUORI_DATABASE_URL='postgres://equori:equori@127.0.0.1:54330/equori?sslmode=disable' EQUORI_INSECURE_COOKIES=true go run ./cmd/equori` (the variable name of `cfg.InsecureCookies` is in `cmd/equori/main.go`). In another shell: `curl -si http://127.0.0.1:8080/accounts` shows status 200, `Cache-Control: no-cache` and `<div id="root"></div>`; `curl -si http://127.0.0.1:8080/api/v1/nope` shows 401 with `application/problem+json` (`RequireSession` runs before routing). Stop the server.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml Dockerfile .dockerignore
git commit -m "ci: build the web interface in ci and in the image"
```
