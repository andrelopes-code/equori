# ADR 036: Country flags from flag-icons

- Status: accepted
- Date: 2026-11-16

## Context

The settings screens mark regions and currencies with flags. The application is self-hosted and, with no source enabled, sends no request to a third party. A flag from a CDN or an API would send one on every visit, would fail offline and would need an entry in the content security policy.

## Decision

- `flag-icons` (MIT) is a development dependency of `web/`. Its 4:3 SVG files are bundled by Vite.
- `ui/region/flag-url.ts` loads each file on demand with `import.meta.glob`, so a page fetches only the flags it shows. Each file is its own chunk.
- `RegionFlag` draws the file in an `img`. While the file loads, when it fails and for a code without a file, it draws a plate with the code.
- The global region keeps its own symbol (`flag-art.tsx`): it names no country.
- A currency takes the flag of the country in the first two letters of its code (`currency-region.ts`).

## Consequences

- No request leaves the installation to draw a flag.
- The package adds about 270 SVG files to the build; only the ones a page shows are downloaded.
- A new region needs no code change: its file is already in the package.
