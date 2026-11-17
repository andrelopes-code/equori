# Card faces

Status: accepted. The owner approved the mock of 2026-11-17 (concept A: a face of identity with the figures on a ticket below it; a stack on the plastic cards tab) and decided D-A to D-F of section 8 on 2026-11-17. This text replaces the draft of 2026-11-16, whose issuer themes, fixed per institution, the owner replaced by an appearance the user chooses.

## 1. Intent

A credit card account holds one institution (`ledger_institution`, identified under ADR 013) and zero or more plastic cards (`Card`: `holder`, `last_four`, `virtual`, `active`). Every screen that draws one draws a tile (`AccountCard`) tinted by one of eight colour slots, with a 22 px logo and no chip, network mark or art.

A card face is an element of the application's own that draws one plastic card at the proportions of the physical card. Its colour, art and finish are chosen by the user, so a face can resemble the plastic it stands for. A statement ticket below the face states what is owed, when, and how much limit is free.

## 2. Goals, non-goals

Goals:

- G1. `CardFace` draws a plastic card from an account, its institution and one `Card`: logo, title, chip, contactless symbol, last four digits, holder, network mark, on a ground of any colour with one of ten arts.
- G2. The user sets the colour (twelve named presets or any `#RRGGBB`), the art, the chip tone, the orientation and the brand treatment of an account, and the network of each plastic card.
- G3. `CardFaceStack` draws the plastic cards of one account as a stack with one card open.
- G4. `StatementTicket` draws, under a face, the statement that asks for action first, its amount, the time left, and the limit; its evidence opens on demand.
- G5. The elements pass the checks of section 6 in the light, dark and glass themes, at 390 px and at desktop width.

Non-goals:

- NG1. A card number, an expiry date or a security code. A face draws `last_four` only.
- NG2. A face for a non-credit account. `AccountCard` keeps the tile of checking and savings accounts.
- NG3. A theme fixed per issuer. The issuer contributes its logo and a suggested colour only.
- NG4. Assistant tools for the appearance (S4).

## 3. Surfaces

| Surface | File | Use | Phone (ADR 027, S3) |
|---|---|---|---|
| Card list | `web/src/features/cards/card-tile/` | One face and one ticket per credit card account | Served: `/cards` |
| Plastic cards tab | `web/src/features/cards/plastic-cards-tab/` | A stack of the account's plastic cards with the detail of the open one | Desktop-only (S5) |
| Card settings tab | `web/src/features/cards/card-settings-tab/` | The appearance form of the account | Desktop-only |
| Add or edit card dialog | `web/src/features/cards/plastic-cards-tab/add-card-dialog.tsx` | A face preview and the network field | Desktop-only |
| Development preview | `/preview/card-face` | Every state of the face and the ticket with fixed data | Development only |

The face lives in `web/src/ui/card-face/` (O2: `accounts` and `cards` both use it). The ticket lives in `web/src/features/cards/card-tile/`.

## 4. Contract

### 4.1 Face

```ts
interface CardFaceProps {
  title: string;                 // Account.name
  logo?: string;                 // logoOf(institution.identifier, index)
  institutionName?: string;      // monogram and name treatment
  holder: string;                // Card.holder; "" draws no holder
  lastFour?: string;             // Card.last_four; absent draws no digits
  network?: string;              // Card.network; a key without a mark draws none
  color?: string;                // "#rrggbb"; absent draws graphite
  art?: string;                  // key of section 4.3; an unknown key draws "plain"
  chip?: "gold" | "silver";      // default "gold"
  orientation?: "horizontal" | "vertical";
  brand?: "auto" | "plate" | "name" | "none"; // section 4.5; default "auto"
  virtual?: boolean;
  active?: boolean;              // default true; false drops colour and art
  peek?: boolean;                // stack: digits and holder in the top row
  link?: LinkOptions;            // the face is one link
  onActivate?: () => void;       // the face is one button
  pressed?: boolean;             // with onActivate: aria-pressed
  loading?: boolean;
}
```

- The face has no size prop. It scales with its container (`container-type: inline-size`, lengths in `cqw`). Below 260 px it drops the holder and the contactless symbol and enlarges the title and the digits; below 130 px it draws the logo and the digits only. Reference widths: 420 (form preview), 320 (list, stack), 220 (picker), 96 (row).
- Anatomy, one margin of 6.5% of the width: brand and title top left; contactless symbol, "Virtual" or "Inactive" top right; chip left at 37.5% of the height; digits above holder bottom left; network mark bottom right.
- The accessible name is `{title}, ending {lastFour}`, followed by the words for virtual and inactive when they hold. Chip, symbol, art and mark are hidden from assistive technology.
- A face with `link` or `onActivate` is an `a` or a `button`; otherwise it is `role="img"`.

### 4.2 Ink

`inkOf(color)` (`ui/card-face/ink.ts`) returns the ink `"light"` (`#ffffff`) or `"dark"` (`#050506`) with the higher WCAG contrast against `color`, and that ratio. With `#050506` as the dark ink the higher ratio is at least 4.5:1 for every sRGB colour; a test sweeps the colour cube. The title, the digits and the holder are drawn in the full ink. The translucent ink serves the contactless symbol and art only.

### 4.3 Arts

Keys: `plain`, `aurora`, `waves`, `orbits`, `band`, `contour`, `dots`, `carbon`, `brushed`, `holo`. `waves`, `orbits`, `band`, `contour`, `dots` and `carbon` are inline SVG on a 400 by 252 field with non-scaling strokes; `aurora` and `brushed` are smooth gradients; `holo` is three layers (spectrum cut by a grating, the spectrum as light in fine lines, the grain as glitter) whose stops follow the pointer, or drift when no pointer is over the face. The approved mock (`docs/superpowers/plans/assets/cards-redesign/mock.html`) holds each drawing.

### 4.4 Motion

A face under a fine pointer tilts up to 7 degrees and draws a glare at the pointer. The holographic art drifts over 9 s. The faces of the card list enter once, staggered by 70 ms. The entrance animates the wrapper and the drift the face, so neither restarts the other. Every motion is off under `prefers-reduced-motion`. No motion carries information.

### 4.5 Brand treatment

A logo is never recoloured or cropped (ADR 013). `logoTraits(pixels)` (`ui/card-face/logo-traits.ts`) reads a logo once in the browser and returns its dominant colour and whether its corners are opaque. `brand` selects:

| Value | Draws |
|---|---|
| `auto` | A logo with opaque corners as its own rounded square. A logo with transparent corners directly on the face when its dominant colour reaches 3:1 against the face colour; otherwise on a plate, white or `#141416`, whichever gives the logo the higher contrast. Without traits (no canvas, logo not loaded): the white plate. |
| `plate` | The logo on the white plate. |
| `name` | No logo; `institutionName` set in the ink before the title. |
| `none` | No brand; the title only. |

Without a logo, `auto` and `plate` draw the monogram of `institutionName` (or of `title`) on the plate.

### 4.6 Networks

A network is a key `^[a-z0-9_]{2,40}$`. `ui/card-face/network/` holds one SVG per mark and a registry from key to mark. The marks of `visa`, `mastercard`, `amex`, `elo` and `hipercard` are the vectors published on Wikimedia Commons, fetched on 2026-11-17 (D-C); each file records its source. `visa` is drawn in the ink; the others keep their colours. `offeredNetworks(region)` returns `visa`, `mastercard`, `amex`, and adds `elo` and `hipercard` for `BR`.

### 4.7 Suggested colour

The colour a new appearance starts from is the dominant colour of the institution's logo (`logoTraits`), when a logo exists; otherwise the account's colour slot; otherwise graphite `#2b2d33`. The form names it "suggested by the issuer's logo" and restores it on request.

### 4.8 Statement ticket

`statementLead(current, unpaid, today)` (`features/cards/card-tile/statement-lead.ts`) returns the statement the ticket leads with:

| Case | Lead | Word | Tone | Time phrase |
|---|---|---|---|---|
| A closed statement still owing, past its due date | The oldest one | Overdue | danger | due {relative days} |
| ... due within `soonDays` (3), the due day included | The oldest one | Due soon | warning | due {relative days} |
| ... paid in part, not overdue | The oldest one | Paid in part | info | due {relative days} |
| ... otherwise | The oldest one | To pay | info | due {relative days} |
| No closed statement owing, an open one | The open one | Open | neutral | closes {relative days} |
| Neither | None | No statement | neutral | none |

- Closed (default) the ticket draws the word, the reference month, the amount (`owedAmount(unpaid)` or `open_amount`), the time phrase and the limit meter. The limit meter has 24 segments, the last fifth tinted as the risk zone, with the free amount (or the amount over the limit, in the danger tone) and the used share of the limit.
- A lead that is a closed statement keeps the "Pay" button of the present stub; it opens the statement with `pay: true`. With more than one closed statement owing the reference reads "{count} statements open". The ticket keeps the group name, the status attribute and the texts of the present stub (`cards.stub.*`), and the limit keeps the texts of `accountCardMeter`.
- A toggle (`aria-expanded`) opens the evidence: the amount paid of the total, the cycle track, the other statement in one line, and the week's purchases. The cycle track places the closing date at 55% and the due date at 92% of its length; `cyclePosition(closing, due, today)` returns today's place: proportional before the closing date over a cycle that starts one calendar month before it (a derivation of the client, since a statement carries no opening date), proportional between closing and due, 97 past the due date.
- Every amount goes through `useMoneyFormat()`; every date and relative day through `i18n/format.ts`.

### 4.9 Stored appearance

- `ledger_account` gains `face_color` (`^#[0-9a-f]{6}$`), `face_art` (`^[a-z0-9_]{2,40}$`), `face_chip` (`gold`, `silver`), `face_orientation` (`horizontal`, `vertical`) and `face_brand` (`auto`, `plate`, `name`, `none`), each nullable.
- `PUT /accounts/{id}/card-face` (`setAccountCardFace`, role `write`) replaces the five values; an absent or null value clears its column. It rejects an account that is not a credit card with the validation problem of `RequireCard`. `Account` returns `face` when any value is set.
- `ledger_card` gains `network` (`^[a-z0-9_]{2,40}$`, nullable). `CardInput`, `CardUpdate` and `Card` carry `network`; in `CardUpdate` an empty string clears it.
- The archive gains one step that writes null into the new columns of older archives.

## 5. Rules of the repository

| Rule | Application |
|---|---|
| O1 | One component per file. `web/src/ui/README.md` lists `card-face/` in the commit of its first file. |
| O5 | The CSS lives in co-located `*.module.css` inside `@layer app`. The face is a physical object on its own material: its ground, ink, chip metal and art are literals of its specification, as `account-card.module.css` precedes; the colour arrives as `--card-face-color` set inline. Every other value is a `--slotted-*` token. |
| O6, R5 | No user-visible literal in JSX. |
| O11 | A face never sits above a blurred surface; `filter`, `mask`, `mix-blend-mode` and `clip-path` apply to descendants of the face only. |
| O13, O14 | The face and the ticket are own elements under `build-own-element`; their comments state that the need is equori's visual identity. A shared piece they rebuild (focus ring, roving focus of the stack, disclosure) is a Slotted finding. The ticket draws its text through `Text`, `StatusIndicator` and `Button`. |
| O18 | The face is not a panel card. The ticket takes the panel tokens. |
| Space rule | A face and a closed ticket have one height per state. No text wraps; a text that does not fit is shortened by the design before it is truncated. No warning triangle icon. |

## 6. Quality criteria

- Q1. Proportion: width over height is 1.586 (ISO/IEC 7810 ID-1), or its inverse when vertical, at every container width.
- Q2. Contrast: section 4.2, with its test.
- Q3. Logo: section 4.5; never recoloured, cropped or combined with another mark.
- Q4. Chip and contactless symbol: vector SVG, one drawing each.
- Q5. Numerals: tabular; the digits keep one width.
- Q6. Arts: vector or smooth gradient; no hard-stop gradient at an angle.
- Q7. Motion: section 4.4.
- Q8. Accessibility: visible focus ring; touch target of at least 44 px on the phone surfaces; under `forced-colors` the face keeps its border and text and drops its finish; no information by colour alone.
- Q9. States: active, inactive, virtual, loading (a placeholder with the anatomy of the face); a stack of one, two, five and ten faces; an account without a card.
- Q10. Performance: on `make run-prod` at 390 px with the CPU throttled 4×, a list of 12 faces scrolls without a long task above 50 ms attributable to the faces.

## 7. Delivery

Two plans in `docs/superpowers/plans/`, in order:

1. `2026-11-17-card-faces-1-element.md`: the face, the stack, the ticket, the card list and the plastic cards tab, on the data the API has today (colour from the account's slot, art `plain`, no network).
2. `2026-11-17-card-faces-2-appearance.md`: section 4.9, the appearance form, the network field and the suggested colour.

Changes to existing tests of `cards-page.test.tsx` follow section 4.8: the limit moves from the card face to the ticket, the week's purchases move into the ticket's evidence, and the closed statement's stub becomes the ticket's lead.

## 8. Owner decisions

| ID | Decision | Answer (2026-11-17) |
|---|---|---|
| D-A | Concept | A face of identity with the figures below it on `/cards`; a stack on the plastic cards tab. The ticket is closed by default. |
| D-B | Appearance | Chosen by the user: any colour, ten arts, chip tone, orientation. Stored on the account (4.9). |
| D-C | Network marks | The faithful drawings: the published vectors of each network (4.6). |
| D-D | Logo | Not always on a white plate: the automatic treatment of 4.5, with the user's override. |
| D-E | Starting colour | Suggested by the issuer (4.7). |
| D-F | Network | Stored on each plastic card (4.9). |

## 9. Cross-cutting questions

- R1: The networks offered vary by country: `offeredNetworks(region)` in `web/src/ui/card-face/network/offered.ts`. The logo and the suggested colour come from the logo resolver of ADR 013.
- R2: A region without a case is offered `visa`, `mastercard`, `amex`. A stored network without a mark draws no mark. An institution without a logo draws its monogram and suggests the slot colour or graphite.
- R3: `network` and `face_art` grow: `^[a-z0-9_]{2,40}$` in SQL and a `pattern` in the API. `face_chip`, `face_orientation` and `face_brand` name treatments of the element, not regional values, and are closed sets.
- R4: Adds the row "Card networks offered" to `docs/contributing/regions.md` in the commit of `offered.ts`.
- R5: Adds `cardFace.*` (name parts, state words, art names, colour names, network names) and `cards.ticket.*` keys, each with pt-BR and en text, listed in the plans.
- R6: The ticket writes amounts through `useMoneyFormat()` and dates, relative days and percentages through `i18n/format.ts`. The face writes `last_four` as stored.
- C1: Does not apply: no amount is stored or computed beyond those the API returns.
- C2: Does not apply: the ticket adds nothing across currencies; `owedAmount` sums the statements of one account.
- C3: Does not apply: the ticket shows the amounts of one account in the account's currency.
- C4: The currency comes from the statement's `Money`; amounts go through `useMoneyFormat()`.
- T1: Today comes from `useToday()`; due and closing dates come from the statement.
- T2: Does not apply: the ticket reads the closing and due dates the API computed.
- B1: Does not apply: no table is added.
- B2: `setAccountCardFace` needs `write`; an HTTP test covers `write`, `read` and no membership.
- B3: Does not apply: the appearance is a fact of the account, not a setting.
- D1: No table is added. The new columns change exported tables: one archive step and a version increment.
- D2: One goose migration adds the six columns.
- D3: Does not apply: no recorded financial fact changes.
- D4: Does not apply: nothing is written from a bank, a file or a model.
- D5: Does not apply: no field enters the diagnostic file.
- S1: Adds `setAccountCardFace`, excluded from the tools in `tool_exposure_test.go` (NG4). No new `Problem.code`.
- S2: The face and the ticket appear on `/cards`, a phone route, designed and tested at 390 px. The other surfaces are desktop-only.
- S3: The guide article `credit_cards_and_statements` describes the ticket, the appearance and the network in the commits that deliver each.
- S4: Does not apply: the assistant needs none of the appearance.
- X1: Does not apply: no acceptance scenario of `docs/domain/06-scenarios.md` is added.
- X2: `offered.test.ts` covers a region other than `BR`. C2 and C3 do not apply.

## 10. Verification

- `ui/card-face/ink.test.ts`: the ink of each preset and the sweep of 4.2.
- `ui/card-face/logo-traits.test.ts`: opaque and transparent corners, dominant colour, an empty image.
- `ui/card-face/brand.test.ts`: each row of 4.5.
- `ui/card-face/card-face.test.tsx`: the accessible name for active, inactive and virtual; link, button and image roles; the loading placeholder; an unknown art and an unknown network.
- `ui/card-face/card-face-stack.test.tsx`: one, two, five and ten faces; selection by pointer and keyboard.
- `ui/card-face/network/offered.test.ts`: `BR` and another region.
- `features/cards/card-tile/statement-lead.test.ts`: each row of 4.8 and the cycle positions.
- `features/cards/pages/cards-page.test.tsx`: the ticket of a card through the page.
- `internal/ledger`: HTTP tests of 4.9 (set, read back, clear, non-card account, roles) and schema tests of each new constraint.

A browser check per plan compares the running screens with the approved mock at 1440 px and 390 px in the light and dark schemes. A defect injected in each new logic file must fail one test.
