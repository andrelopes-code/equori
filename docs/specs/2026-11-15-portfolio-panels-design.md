# Portfolio panels and action weight

Status: accepted by the owner on 2026-11-15 (concept A of the redesign mock). Amends the layout of `docs/specs/2026-11-07-portfolio-clarity-design.md` (PC1, PC8, PC9); the content and order of PC1 stay.

## Problem

Measured on `/portfolio` with the demo book at 1440 px, before this change:

- The three body sections (return, where the money is, holdings) titled themselves with a 13 px uppercase label. The verdict inside the return section ("In the period, the portfolio returned 14.18%") was 15 px semibold, heavier than the title of its own section.
- The return section had no ground; the allocation and holdings tables had a frame. The gap between sections equalled the gap inside them (`Stack gap={6}`).
- Every action on the page was `outline` and `secondary`, the same weight as the currency and date filters. The page had no `solid` action, against the "Headers" rule of `docs/contributing/web.md`. The trade action sat in the holdings section, halfway down the page.
- A long instrument name wrapped to two centered lines, and its code wrapped to a second line ("NASD1 / 1").

## Rules

| ID  | Rule                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PP1 | The return, where and holdings sections are `Section size="lg" ground="surface"`. The figure cards stay above them. The body stack between panels is `gap={8}`.                                                                                                                                                                                                                      |
| PP2 | A large section on a surface titles itself in mixed case at `--slotted-font-size-xl`, with normal tracking: the panel title reads one step above the verdict inside it. Theme rule `panelTitleRule` in `web/src/theme/equori.theme.ts` (Slotted issue #116). It applies to every such section of the application.                                                                    |
| PP3 | The page header holds the controls (help, currency, date), a vertical `Divider`, then the actions by rising weight: income and sales (`ghost`), contribution plan (`outline`), record a trade (`solid`, accent, `plus` glyph). The trade appears when the book has a brokerage, the date holds a position and the positions loaded; otherwise the empty state carries it (PC8, BC9). |
| PP4 | The holdings section keeps Columns (`ghost`) and Record income (`outline`); the trade leaves it.                                                                                                                                                                                                                                                                                     |
| PP5 | An instrument name keeps one line: a long name ends in an ellipsis with the whole name in its `title`, and the code never shrinks (`ui/display/instrument-name`). Applies to every table that draws it.                                                                                                                                                                              |
| PP6 | The holdings grid and the where table run edge to edge in their surface sections: `variant="ruled"`, no frame of their own, the lower corners on the section radius (`ui/display/section-bleed.module.css`, Slotted issue #118). The table of `assets-allocation` keeps its frame.                                                                                                   |

## Cross-cutting questions

- R1: Does not apply: no regional value added.
- R2: Does not apply: no regional behavior.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: Does not apply: no text added; existing catalog keys move place.
- R6: Does not apply: no number or date added.
- C1: Does not apply: no amount stored or computed.
- C2: Does not apply: no sum added.
- C3: Does not apply: currency display unchanged.
- C4: Does not apply: amounts keep `useMoneyFormat()`.
- T1: Does not apply: no date added.
- T2: Does not apply: no business-day count.
- B1: Does not apply: no table.
- B2: Does not apply: no operation.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: no recorded fact changes.
- D4: Does not apply: no imported data.
- D5: Does not apply: no diagnostic field.
- S1: Does not apply: no operation in `api/openapi.yaml`.
- S2: No: `/portfolio` is desktop-only (ADR 027, S3).
- S3: Does not apply: the user can do the same things; only the place and weight of the actions change. `internal/assistant/guide/articles/investments.md` names no button place.
- S4: Does not apply: no data for the assistant.
- X1: Does not apply: no scenario added; `portfolio-page.test.tsx` covers PP1, PP3, PP5 and PP6, `equori.theme.test.ts` covers PP2.
- X2: Does not apply: R1, R2, C2 and C3 do not apply.
