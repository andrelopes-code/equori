# ADR 013: Institution logos

- Status: accepted
- Date: 2026-10-21

## Context

An account names its institution only by text. The account picker of the entry form draws a mark per account, and a mark made of two letters does not identify Nubank, Mercado Pago or Itaú at a glance. `ledger_institution` holds `name` and a free-text `code`; neither identifies the institution outside the user's own data. ADR 008-web-interface serves the application under `default-src 'self'`, so a logo cannot load from a third-party origin, and a request to a CDN would tell a third party which institutions the user holds.

The ISPB is the eight-digit identifier the Banco Central do Brasil gives every participant of the payment system (STR and Pix). It is stable across renames and covers institutions without a COMPE code.

## Decision

`web/package.json` adds one dependency, pinned to an exact version:

| Package | Version | License | Purpose |
|---|---|---|---|
| `logos-bancos-br` | 0.8.2 | MIT (code and data); logos remain trademarks of their owners | Catalogue of the institutions of the STR and Pix lists, keyed by ISPB, with the logo each institution publishes in the Open Finance Brasil directory |

- `ledger_institution` carries an identifier `{scheme, identifier}`, unique per user and scheme, set at creation or through `PUT /institutions/{id}/identifier`. The scheme `br_ispb` holds an ISPB (eight digits).
- A logo resolver per scheme maps an identifier to a logo URL (`logoOf` in `web/src/features/accounts/institution-logo.ts`). `br_ispb` is the only scheme with a resolver; an institution with another scheme is drawn with its monogram.
- The bank catalogue is offered only when the profile region is `BR`.
- The web application resolves an ISPB to the package's 256 × 256 PNG through `import.meta.glob`. Vite emits each PNG as a hashed asset, and `web/embed.go` embeds it in the binary. A browser fetches one logo only when a mark draws it.
- The package's SVG set covers fewer institutions (140 files against 187 PNG files in 0.8.2) and is not used.
- An institution without an identifier, or with an ISPB the catalogue has no logo for, is drawn with its monogram.
- A logo identifies its institution only. It is never recoloured, cropped beyond its own square or combined with another mark, as the package's `DISCLAIMER.md` requires.

## Consequences

- The binary grows by the PNG files, 1.2 MB in 0.8.2.
- A logo update is a version bump of the package, reviewed as any dependency update.
- Institutions created before this decision have no ISPB until the user sets it.
