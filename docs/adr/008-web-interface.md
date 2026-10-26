# ADR 008: Web interface delivery

- Status: accepted
- Date: 2026-10-16

## Context

The web interface is the only client of equori (`docs/domain/01-vision.md`: no native mobile apps). The product ships as one binary in one container. Next.js runs its Server Components, Server Actions, middleware and route handlers in a Node.js server; its static export (`output: 'export'`) removes them and requires every dynamic route to be known at build time.

## Decision

| ID | Rule |
|---|---|
| W1 | `web/` is a single-page application (SPA) built with Vite, React and TypeScript. The browser resolves routes; no Node.js process runs in production. |
| W8 | Package `web` (`web/embed.go`) embeds `web/dist` with `//go:embed all:dist`. `web/dist/.gitkeep` is committed, so `go build` and `go test` run without a Vite build. |
| W9 | `internal/platform/spa` serves the embedded tree on every path outside `/api/` and `/healthz`. A regular file returns that file. Any other `GET` or `HEAD` path returns `index.html` with 200, except paths under `assets/`, which return 404. Other methods return 405 with `Allow: GET, HEAD`. Unknown `/api/` paths keep the 404 problem. |
| W10 | A tree without `index.html` answers 404 outside `/api/`. The API is unaffected. |
| W11 | Files under `assets/` carry Vite content hashes and return `Cache-Control: public, max-age=31536000, immutable`. `index.html` returns `Cache-Control: no-cache`. |
| W12 | Responses outside `/api/` carry `Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`, in addition to the headers C9 of ADR 007 sets on every response. |
| W13 | Modules of `web/src` import each other through the alias `@/`, which maps to `web/src/`. The `paths` entry of `web/tsconfig.json` is its only definition; Vite and Vitest read it through `resolve.tsconfigPaths`. ESLint `no-restricted-imports` rejects every import that starts with `./` or `../`. |
| W14 | In development, `EQUORI_WEB_DEV_PORT` (set to 5173 in `dev.env`) replaces W9: every `GET` or `HEAD` path outside `/api/` answers 307 to the Vite server on that port of the request's host, with the same path and query; other methods answer 405. The embedded tree is a build that `make dev` does not refresh, so the application's port never shows it in development. Unset, as in production, W9 holds. |
| W15 | Amendment of 2026-10-26. `/sw.js` is served with `Cache-Control: no-cache`, like `index.html`. The service worker stores `/`, the files under `assets/` that it names, `/boot.js`, `/boot.css`, `/manifest.json` and `/icon.svg`, and no `/api/` answer. Reason: the installed application opens without the server (ADR 022, D7). |

## Consequences

- The browser and the API share one origin, so the session cookie of ADR 003 needs no CORS configuration.
- A deploy replaces `index.html` and the hashed assets together; a browser holding the previous `index.html` gets 404 for a removed asset instead of HTML served as a script.
- The CSP forbids inline scripts and styles and resources from other origins; a library that needs either requires an amendment.
- Building the image requires Node.js; building and testing the Go code does not.
