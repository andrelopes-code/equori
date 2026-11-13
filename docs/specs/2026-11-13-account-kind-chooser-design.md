# Account kind chooser

The first step of `/accounts/new` becomes a gallery of illustrated kinds, split by the side of the balance sheet, beside a panel that states what the chosen kind is and what the form will ask. Amends BC1 of `docs/specs/2026-11-12-brokerage-clarity-design.md`.

## 1. Diagnosis

Facts from `web/src/features/accounts/account-form/kind-chooser.tsx` and the demo book rendered at 1440 px on 2026-11-13.

| ID  | Fact                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Eleven kinds sit in five `RadioGroup variant="tile"` sets, each stretched over the 1120 px body. The groups "Cards" and "Investments" hold one kind each and draw one tile across the whole width. |
| F2  | A tile carries a radio mark, a title and a hint. The kind's shape (`account-shape.ts`), which the rest of the app uses to tell kinds apart, does not appear.                                       |
| F3  | One click on a tile opens the form, so the radio mark announces a choice the screen never holds. The footer's "Create account" stays disabled during the step.                                     |
| F4  | `receivable`, an asset, sits in the group "Debts and receivables" beside two liabilities. The side of the balance sheet (`classOf`) appears nowhere.                                               |
| F5  | Nothing states what a kind changes in the form or after creation, although the code fixes it: section 4.                                                                                           |
| F6  | `NewAccountScreen` receives every account of the book; the number of accounts of each kind is not shown.                                                                                           |

## 2. Questions

1. Which kind fits what I want to record?
2. Does it add to or subtract from my net worth?
3. What will the form ask, and where will the account appear?

## 3. Rules

**KC1 Layout.** The step is a two-column `split`: the gallery, then the panel of 25rem (400 px). The gallery holds two blocks, "What you have" with the note "Adds to net worth", and "What you owe" with the note "Subtracts from net worth". A block lists its kinds in this order: assets `checking`, `cash`, `wallet`, `benefit`, `savings`, `reserve`, `brokerage`, `receivable`; liabilities `credit_card`, `loan`, `payable`. Three tiles per row.

**KC2 Tile.** A tile is a radio. From top to bottom it holds the kind's scene (section 5) at the tile's width with the 352:140 ratio, then one row of 40 px with the title and, end-aligned, the count of KC6 when it is above zero. No radio mark, no hint. Text never wraps; the title is the only text that may be cut with an ellipsis, and none of the eleven titles is cut at 1240 px.

**KC3 Choice.** A click or a key chooses a kind and keeps the gallery on screen: the chosen tile rises 2 px and takes the accent ring, and the panel shows the kind. "Continue" in the footer, enabled once a kind is chosen, opens the form. "Discard" keeps its behavior.

**KC4 Keyboard.** The gallery is one `radiogroup` with one tab stop on the chosen tile, or on the first tile when none is chosen. ArrowRight and ArrowLeft move the choice by one tile, ArrowDown and ArrowUp by three, across both blocks in KC1 order, stopping at the ends. Enter on a chosen tile opens the form, as "Continue" does.

**KC5 Motion.** On a choice, the panel mounts its content again and plays one entrance, under `prefers-reduced-motion: no-preference` only: the rings of its scene open from scale 0.9, 50 ms apart from the centre outward; the drawing lands from 4 drawing units below at 96 % size; its half-tone back layer settles after the front; the blocks under the scene rise 4 px into place, 40 ms apart. Every part runs on `cubic-bezier(.16, 1, .3, 1)` in 450 to 700 ms. Nothing covers the page while it runs, so every tile stays clickable. A tile hovered, focused from the keyboard or chosen holds a pose, under `prefers-reduced-motion: no-preference` only: the rings swell from the centre outward (scale 1.06, 1.08, 1.10 and 1.12, each 40 ms after the previous one) and take 10 % more ink, as does the stage (5 %); the drawing rises 3 drawing units and grows 5 % from its base; its half-tone back layer moves a further 1 unit right and 2.4 units up, so the layers part in depth; the tile rises 1 px with `--slotted-shadow-sm`. Every part moves on the same curve in 600 ms (700 ms for the back layer). The scene of the panel holds no pose.

**KC6 Count.** The count of a kind is the number of accounts with that `kind` and no `closed_on`. For `brokerage`, only accounts without `parent_id` count: the cash line and the positions are children of the brokerage (BC2). Written as "1 account" or "{count} accounts", and as "1 card" or "{count} cards" for `credit_card`, the number through `numberFormatter`.

**KC7 Panel.** The panel shows, from top to bottom: the scene at the panel's width; the kind's title; the side line; the kind's `kind.hint` text, one line per sentence; "The form asks for" with the numbered steps of section 4, steps that only this kind has marked in the accent; "Once created" with three facts of section 4, values end-aligned. With no kind chosen, the panel shows the scene of `checking` in neutral ink, "Choose a kind beside" and "This panel shows what the form asks for."

**KC8 Way back.** "Change kind" on the form returns to the gallery with the current kind chosen. A kind given by `?kind=` opens the form directly, as today.

**KC9 Summary.** `KindSummary` on the form draws the kind's plate (section 5) at 48 px in place of the check mark.

**KC10 Own element.** The tile and the gallery are an element of the app's own (build-own-element skill): `RadioGroup variant="tile"` draws a mark and a label with a description, and offers no media slot and no way to hide the mark. The gap is a Slotted finding in the `family` area, opened before the element is committed and cited in its comment.

## 4. Facts of the panel

Each fact is computed by a pure function from the predicates the form already uses, so the panel and the form cannot disagree. The steps follow the order in which `AccountForm` renders its sections: identity, details, cash mode, opening, card setup. A field drawn inside the details section (`accountForm.yield`) is listed right after the details step.

| Fact                    | Rule                                                                                                                                                                                                                     | Source                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Side line               | "Liability · subtracts from net worth" for `credit_card`, `loan`, `payable`; "Asset · adds to net worth" for the others                                                                                                  | `classOf`                                                                |
| Step 1                  | "Name and institution"                                                                                                                                                                                                   | `AccountIdentitySection`                                                 |
| Step 2                  | "Currency, opening date, parent account and colour"; for `brokerage`, "Currency, opening date and colour"                                                                                                                | `AccountDetailsSection`, `showParent` (BC2)                              |
| Own steps               | `credit_card`: `accountForm.billing`, `accountForm.limitGroup`, `accountForm.cards`. `savings`, `reserve`: `accountForm.yield`. `brokerage`: `kindPanel.stepCashMode` with the suffix ", once the institution is chosen" | `CardSetupSection`; `yieldCapable`; `CashModeField`                      |
| Opening step            | `openingLabel(kind, classOf(kind))`; for `brokerage`, `kindPanel.stepOwnCash`, since its opening field shows only when the cash is its own. For `credit_card` it precedes the three card steps                           | `AccountOpeningSection`, `showOpening`                                   |
| Opens in                | "Cards" (`nav.cards`) for `credit_card`; "Accounts" (`nav.accounts`) for the others                                                                                                                                      | `destination` in `new-account-screen.tsx`                                |
| Counts toward liquidity | "Yes" for `checking`, `savings`, `cash`, `wallet`, `reserve`; "No" for the others                                                                                                                                        | `liquidCapable`; `liquidKinds` in `internal/reporting/app/indicators.go` |
| Accounts of this kind   | KC6; "None yet" at zero. For `credit_card` the label is "Cards of this kind"                                                                                                                                             | KC6                                                                      |

## 5. Art

The drawings come from the mock approved on 2026-11-13. Each kind has two drawings on a grid of 48 units: the panel drawing (the whole object with its back layer) and the plate drawing (the main object alone, inside 30 of the 48 units). Three values of one ink: the solid ink, a half tone (45 % of the solid over the plate) and a cut-out in the plate's colour; strokes of 1.6 units with round caps.

- Ink: `--equori-slot-3` for an asset, `--equori-slot-4` for a liability. The solid is the ink mixed with `--slotted-text` (88 % in the light scheme, 92 % in the dark scheme); the plate is the ink at 18 % over `--slotted-surface` with a 30 % hairline, as in `account-mark.module.css`.
- Plate: a circle for `savings`, `reserve`, `brokerage`; a rounded square (`rx` 13 of 48) for the others, the card included.
- Scene: viewBox 352 × 140, four rings of the plate's shape centred at (176, 70) with sides 400, 300, 210 and 116 (the ink at 18 %, 13 %, 9 % and 6 % over the surface), and the panel drawing at `translate(130.4 24.4) scale(1.9)`, which leaves 12 units between the innermost ring and the top and bottom of the stage.
- Every SVG is `aria-hidden`: the tile's and the panel's text carry the name.
- Forced colors: every shape becomes a `CanvasText` outline over `Canvas`; the three outer rings are hidden. The chosen tile takes a 3 px `Highlight` outline.
- A twelfth kind picks its shape, draws its main mass in the solid ink, cuts its details out, and adds its back layer in half tone for the panel drawing.

## 6. Texts

| Key                             | en                                                | pt-BR                                         |
| ------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| `kindChooser.label`             | Account kind                                      | Tipo de conta                                 |
| `kindChooser.assets`            | What you have                                     | O que você tem                                |
| `kindChooser.assetsNote`        | Adds to net worth                                 | Soma no patrimônio                            |
| `kindChooser.liabilities`       | What you owe                                      | O que você deve                               |
| `kindChooser.liabilitiesNote`   | Subtracts from net worth                          | Desconta do patrimônio                        |
| `kindPanel.asset`               | Asset · adds to net worth                         | Ativo · soma no patrimônio                    |
| `kindPanel.liability`           | Liability · subtracts from net worth              | Passivo · desconta do patrimônio              |
| `kindPanel.asks`                | The form asks for                                 | O formulário pede                             |
| `kindPanel.after`               | Once created                                      | Depois de criado                              |
| `kindPanel.opensIn`             | Opens in                                          | Abre em                                       |
| `kindPanel.liquidity`           | Counts toward liquidity                           | Entra na liquidez                             |
| `kindPanel.yes`                 | Yes                                               | Sim                                           |
| `kindPanel.no`                  | No                                                | Não                                           |
| `kindPanel.accounts`            | Accounts of this kind                             | Contas deste tipo                             |
| `kindPanel.cards`               | Cards of this kind                                | Cartões deste tipo                            |
| `kindPanel.noAccounts`          | None yet                                          | Nenhuma ainda                                 |
| `kindPanel.noCards`             | None yet                                          | Nenhum ainda                                  |
| `kindPanel.countOne`            | 1 account                                         | 1 conta                                       |
| `kindPanel.countMany`           | {count} accounts                                  | {count} contas                                |
| `kindPanel.countOneCard`        | 1 card                                            | 1 cartão                                      |
| `kindPanel.countManyCard`       | {count} cards                                     | {count} cartões                               |
| `kindPanel.stepIdentity`        | Name and institution                              | Nome e instituição                            |
| `kindPanel.stepDetails`         | Currency, opening date, parent account and colour | Moeda, data de abertura, conta-mãe e cor      |
| `kindPanel.stepDetailsNoParent` | Currency, opening date and colour                 | Moeda, data de abertura e cor                 |
| `kindPanel.stepCashMode`        | Where the cash is                                 | Onde fica o caixa                             |
| `kindPanel.afterInstitution`    | {step}, once the institution is chosen            | {step}, depois da instituição                 |
| `kindPanel.stepOwnCash`         | Cash in the brokerage, if it keeps its own        | Dinheiro já na corretora, se o caixa for dela |
| `kindPanel.emptyTitle`          | Choose a kind beside                              | Escolha um tipo ao lado                       |
| `kindPanel.emptyBody`           | This panel shows what the form asks for.          | O painel mostra o que o formulário pede.      |
| `accountForm.continue`          | Continue                                          | Continuar                                     |

## 7. Cross-cutting questions

- R1: Does not apply: no value varies by country; the kinds and their rules are the same in every region.
- R2: Does not apply: no regional implementation is involved.
- R3: Does not apply: no value set is added.
- R4: Does not apply: no extension point is added.
- R5: The keys of section 6, each with en and pt-BR text.
- R6: The count of KC6, through `numberFormatter`. No date is written.
- C1: Does not apply: no amount is stored or computed.
- C2: Does not apply: no amount is added or compared.
- C3: Does not apply: the step shows no amount.
- C4: Does not apply: the step shows no currency.
- T1: Does not apply: the step uses no date.
- T2: Does not apply: nothing depends on a business day or a due date.
- B1: Does not apply: no table.
- B2: Does not apply: no operation is added; the step reads `GET /accounts`, which the screen already calls.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: no recorded fact changes.
- D4: Does not apply: nothing is written from a bank, a file or a model.
- D5: Does not apply: the diagnostic file is untouched.
- S1: Does not apply: no operation in `api/openapi.yaml`.
- S2: No: `/accounts/new` is desktop-only (ADR 027, S3).
- S3: Yes: `accounts_and_categories.md` describes the gallery, the two sides and the panel in the commit of KC3.
- S4: Does not apply: the assistant creates accounts through its existing tool; the panel adds no datum the tool lacks.
- X1: Does not apply: no scenario of `docs/domain/06-scenarios.md` changes; the step is client-side.
- X2: Does not apply: R1, R2, C2 and C3 do not apply.

## 8. Tests

- The pure functions of section 4 and KC6, with a table per kind derived by hand from the rules above.
- Every kind has a panel drawing and a plate drawing.
- Through `renderApp("/accounts/new")`: the two blocks and their eleven radios; a click chooses without leaving the step; the panel facts for `credit_card` and `reserve`; ArrowRight from `checking` chooses `cash`; "Continue" opens the form; "Change kind" returns with the kind chosen; the count of KC6 with a brokerage that has children.

## 9. Amendments

- BC1 of `docs/specs/2026-11-12-brokerage-clarity-design.md`: `brokerage` is a tile of "What you have" (KC1); its hint is the panel's description (KC7). The test "offers the brokerage alone under Investments" changes to the panel's description of `brokerage`.

## 10. Out of scope

- The fields of the form after the step, and `AccountPreview`.
- The edit form, where the kind is fixed.
- The phone, outside the scope of ADR 027.
