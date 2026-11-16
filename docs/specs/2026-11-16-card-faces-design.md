# Card faces

Status: draft, awaiting owner decisions D-A to D-D of section 8. Owner directive of 2026-11-16: the card of a credit card account is drawn as the plastic it stands for, with the colors and the design of its issuer, and a viewer reads the result as work finished pixel by pixel.

## 1. Intent

A credit card account holds one institution (`ledger_institution`, identified by ISPB under ADR 013) and zero or more plastic cards (`Card`: `holder`, `last_four`, `virtual`, `active`). Every screen that draws one today draws a tile (`AccountCard`, `account-card/`) tinted by the account's colour slot. The institution is recognised by its logo only.

A card face is an element of the application's own that draws one plastic card at the proportions of the physical card, with a finish and a layout per issuer. A card face stack draws several faces as one group.

This spec fixes the scope, the data contract, the rules of the repository the faces obey, the quality criteria and the acceptance checks. The visual design of each issuer, the choice of finishes and the motion are the work of the implementing session, bounded by sections 4 to 6.

## 2. Goals, non-goals

Goals:

- G1. One `CardFace` element draws a plastic card in two orientations and three sizes, from the data of `Card` and of its institution.
- G2. One theme per issuer sets the palette, the finish, the layout and the optional details of its face. The first set holds the issuers of section 7.
- G3. An issuer without a theme, an account without an institution and a region without an issuer catalogue draw the neutral face of section 5.
- G4. One `CardFaceStack` draws a group of faces: the plastic cards of one account, or the credit cards of a book.
- G5. The face passes the checks of section 6 in the light, dark and glass themes, at 390 px and at desktop width.

Non-goals:

- NG1. A network mark (Visa, Mastercard, Elo, other): `Card` stores no network. A face draws no network mark until an amendment adds the field (D-C).
- NG2. A card number, an expiry date or a security code: the application never holds them. A face draws `last_four` only.
- NG3. Drawing a card of a non-credit account. `AccountCard` keeps the tile of checking and savings accounts.
- NG4. Replacing `AccountCard`. The tile keeps its role in lists of accounts; a later change may place a face inside it.
- NG5. A schema, API or assistant change.

## 3. Surfaces

| Surface | File today | Use of the face | Phone (ADR 027, S3) |
|---|---|---|---|
| Card list | `web/src/features/cards/card-tile/` | One face per credit card account, `sm` | Served: `/cards` |
| Card header | `web/src/features/cards/card-header/` | One face of the account's default plastic card, `md` | Served: `/cards/$accountId` |
| Plastic cards tab | `web/src/features/cards/plastic-cards-tab/` | A stack of the account's plastic cards, `lg` for the selected one | Desktop-only (S5) |
| Account creation | `web/src/features/accounts/kind-chooser/` | Optional preview of the chosen institution's face | Desktop-only |

The element lives in `web/src/ui/card-face/`, because `accounts` and `cards` both use it and O2 allows a feature to import another only through its `index.ts`. `index.ts` of `ui/card-face/` exports `CardFace`, `CardFaceStack` and the prop types.

## 4. Contract

The contract below is the starting point. The implementing session may rename or add props when a design need requires it, and records each change in this section.

```ts
interface CardFaceProps {
  // Institution of the account. Without it the face is neutral.
  institution?: { scheme: string; identifier: string };
  // Account colour slot (accountCardColor); tints the neutral face only.
  colorSlot?: number;
  holder: string;
  lastFour: string;
  virtual?: boolean;
  // Card.active. An inactive card keeps its layout and loses its finish.
  active: boolean;
  // Product line of the issuer (D-D); an unknown key selects the issuer's default line.
  line?: string;
  orientation?: "horizontal" | "vertical";
  size: "sm" | "md" | "lg";
  // Present only when the face is a control (selection in a stack, link to the card).
  onActivate?: () => void;
  loading?: boolean;
}
```

- A face resolves its theme from `institution` through `faceThemeOf(scheme, identifier)`. The function is pure, lives in `ui/card-face/theme/`, and returns `undefined` for a pair without a theme.
- A face resolves its logo through `logoURL` of `features/accounts/model/institution-logo.ts`, as `AccountCardPreview` does.
- A theme is data: palette, finish, layout, details, `line` overrides, the source and the verification date of each palette value.
- A face takes its texts (accessible name, state words) from `useT()`. It writes no amount, so `useMoneyFormat()` does not apply.
- The accessible name of a face holds the institution name, the product line when known, the `last_four` and the state. A face that is a control is a link or a button by its caller, never a `div` with a handler.

## 5. Rules of the repository

| Rule | Application to the face |
|---|---|
| O1 | One component per file in kebab-case. `web/src/ui/README.md` lists the new folder `card-face/` in the same commit as the first file. |
| O5 | The face's CSS lives in co-located `*.module.css` inside `@layer app`. An issuer palette is not a `--slotted-*` token. The face sets its own `--equori-card-*` custom properties inline from the theme, as `--equori-slot-N` precedes. The spec amends O5 to name this exception, in the same commit as the first theme. Every other value the face reads is a `--slotted-*` token. |
| O6, R5 | No user-visible literal in JSX. Every text has a catalog key with pt-BR and en text. |
| O11 | A face never sits above a blurred surface. `filter`, `mask`, `mix-blend-mode`, `clip-path` and `opacity` below 1 are allowed on descendants of the face only. A rounded face uses `border-radius` with `overflow`. |
| O13, O14 | The face is an own element built under `build-own-element`. Its comment states that the need is the visual identity of an issuer, which a Slotted family would flatten. A shared piece the face rebuilds (focus ring, state layer, roving focus of the stack) is a Slotted finding in the area `utility` or `token`, reported under `web/CLAUDE.md`. |
| O18 | The face is not a panel card. It takes no `--slotted-panel-*` material. The container that holds a stack takes them. |
| O10 | The face writes no number or date. |
| Space rule | A face has a fixed height per size and state. No text wraps. A text that does not fit is shortened by the design (a shorter word, another place) before it is truncated. No warning triangle icon. |

Neutral face: a face without a theme draws the proportions, the chip, the logo when one exists, the holder and the `last_four`, on a ground derived from `colorSlot` (`accountCardColor`) or from the surface tokens when the slot is absent. Its contrast meets section 6, C1.

## 6. Quality criteria

Each criterion is checkable. A criterion that fails stops the task that introduced it.

- Q1. Proportion: width over height is 1.586 (85.60 mm by 53.98 mm, ISO/IEC 7810 ID-1), or its inverse in the vertical orientation, at every size and every container width. The face sizes itself from its container with `aspect-ratio` and container query units, so chip, type, margins and logo scale together.
- Q2. Contrast: the holder and the `last_four` reach 4.5:1 against the ground of every theme, in the light, dark and glass schemes. A test computes the ratio from the theme data.
- Q3. Logo: an issuer logo is drawn as ADR 013 requires. It is never recoloured, cropped beyond its own square or combined with another mark. The face sets the ground around the logo, not the logo.
- Q4. Chip and contactless symbol: vector SVG, one drawing for the family, one position per layout.
- Q5. Numerals: the `last_four` and any digit group use tabular numerals. A masked and an unmasked state occupy the same width.
- Q6. Materials: a finish (matte, gradient, metallic, other) is built from layered gradients and, where it adds realism, a texture. A flat fill is the neutral face only.
- Q7. Motion: an interactive highlight (pointer, focus, selection) is off under `prefers-reduced-motion`. No motion carries information.
- Q8. Accessibility: visible focus ring at 3:1; touch target of at least 44×44 px (`docs/contributing/mobile.md`) on the phone surfaces; behaviour under `forced-colors` (the face keeps its border and text, the finish is dropped); no information by color alone.
- Q9. States: the face draws `active`, `inactive`, `loading` (a placeholder with the anatomy of the face, `waiting-states` skill) and `virtual`. A stack draws one, two, five and ten faces.
- Q10. Performance: measured on `make run-prod` at 390 px with the CPU throttled 4× (`web/CLAUDE.md`, "Measure on the production build"): a list of 12 faces scrolls without a long task above 50 ms attributable to the faces.
- Q11. Palette provenance: each theme records, per color, the source (public brand guide or sampling of the issuer's published logo or card image) and the date. A theme without a source is not merged.

## 7. First set and reference issuer

Reference issuer: Nubank (ISPB 18236120, the constant of `account-card-preview.tsx`). The first task delivers its theme and the neutral face, reviewed by the owner in the browser against the physical card before any other theme starts. The axes of the theme (palette, finish, layout, details, lines) are extracted from the reference, and the other issuers enter as data on those axes.

Second task: Itaú (ISPB 60701190), Banco do Brasil, Mercado Pago, Bradesco. Third task: Santander, Caixa, Inter, C6. The ISPB of each is read from `logos-bancos-br`; none is typed from memory.

A face of the set differs from the others by more than its color: orientation, finish, logo position and the treatment of the holder and the digits are decided per issuer.

## 8. Owner decisions

| ID | Decision | Default if the owner leaves it open |
|---|---|---|
| D-A | Use of an issuer's palette and card composition to represent the user's own card. ADR 013 covers the logo (nominative use) and does not cover the palette or the composition. | Palette from the public brand guide, composition drawn by the application, not a copy of the plastic. The owner records the decision in an ADR before task 2. |
| D-B | Reference issuer. | Nubank. |
| D-C | A network mark needs a stored `network` on `Card` (schema, API, archive version, assistant tool). | Out of scope here. A later spec adds it. |
| D-D | Product lines of one issuer (for example a standard line and a premium line) need an attribute on `Card` or on the account. | Out of scope here. The `line` prop exists and every issuer has one default line until an attribute is stored. |

## 9. Cross-cutting questions

- R1: The issuer theme varies by country. It is keyed by identifier scheme and identifier (`br_ispb` first), in `web/src/ui/card-face/theme/`, one file per scheme.
- R2: A scheme without a registry, an identifier without a theme and an account without an institution draw the neutral face of section 5.
- R3: Does not apply: no stored value set is added.
- R4: Adds the row "Card face theme" to the extension points of `docs/contributing/regions.md`, with its interface file, the implementation directory, the registry entry and the test file.
- R5: Adds `cardFace.*` keys: accessible name parts, state words (`active`, `inactive`, `virtual`, `loading`), stack labels. Each has pt-BR and en text.
- R6: Does not apply: the face writes no number or date format. The `last_four` is a string of digits.
- C1: Does not apply: no amount is stored or computed.
- C2: Does not apply: no amounts are added or compared.
- C3: Does not apply: no amount is shown.
- C4: Does not apply: no currency is shown.
- T1: Does not apply: no date is used.
- T2: Does not apply: no business day is counted.
- B1: Does not apply: no table is added.
- B2: Does not apply: no operation is added.
- B3: Does not apply: no setting is added.
- D1: Does not apply: no table is added.
- D2: Does not apply: no schema change.
- D3: Does not apply: no recorded fact changes.
- D4: Does not apply: no data is written from a bank, a file or a model.
- D5: Does not apply: no field enters the diagnostic file.
- S1: Does not apply: no operation is added to `api/openapi.yaml`.
- S2: The face appears on `/cards` and `/cards/$accountId`, which are phone routes (ADR 027, S3). It is designed and tested at 390 px on those two surfaces and at desktop width on all four. The plastic cards tab and the account creation preview stay desktop-only (S5).
- S3: Does not apply: no user action changes. The guide article `credit_cards_and_statements` keeps its text.
- S4: Does not apply: the assistant needs none of the face's data.
- X1: Does not apply: no acceptance scenario of `docs/domain/06-scenarios.md` is added; the checks are in section 10.
- X2: R2 has a test with an institution of scheme `bic` and one without institution, both drawing the neutral face. C2 and C3 do not apply.

## 10. Verification

Tests sit next to the code (`ui/card-face/`).

- `theme/face-theme.test.ts`: `faceThemeOf` returns the theme of a known pair and `undefined` for an unknown scheme, an unknown identifier and an empty identifier.
- `theme/contrast.test.ts`: every theme in every scheme reaches Q2. A theme whose ratio falls below 4.5:1 fails the test.
- `theme/provenance.test.ts`: every palette value of every theme has a source and a date (Q11).
- `card-face.test.tsx`: the accessible name of Q8 for an active, an inactive and a virtual card; the neutral face for `bic` and for no institution; the loading placeholder; the element is a control only when `onActivate` is set.
- `card-face-stack.test.tsx`: one, two, five and ten faces; keyboard selection of a face; reduced motion drops the highlight.

A browser check by the implementing session, with at most four screenshots per scenario: the reference issuer and the neutral face in the light, dark and glass schemes, at 390 px and at desktop width; `forced-colors` once. The owner reviews the reference issuer in the browser before task 2 (section 7).

A defect injected in each new logic file (an inverted comparison in `faceThemeOf`, a swapped color in a theme) must fail one test. A file whose defect no test catches is reported as uncovered.

## 11. Delivery

One vertical slice per commit. The plan goes to `docs/superpowers/plans/` and cites the rule IDs of this spec (Q1 to Q11, D-A to D-D). Each task ends with `make web-check`. The amendment of O5 (section 5) and the row of `regions.md` (R4) land in the commit of the first theme.
