# Mobile settings

Status: approved 2026-11-21 (owner delegated the design decisions of the phone redesign). Wave 4 of the phone redesign.

Below 600 px the index of `/settings` and the appearance studio hold one row per section, each of one height: the section's icon, its name, one line that says what it holds, and the arrow onward.

## Rules

| ID | Rule |
|---|---|
| ST1 | A group of the settings navigation whose every section is hidden from the reader (the system group for a member who is not an administrator) draws no label, at every width. |
| ST2 | Each row's summary holds one line and cuts with an ellipsis at the row's end. The summaries of security, appearance, members, market data and the assistant read in at most 41 characters, so none cuts at 360 px. |
| ST3 | On `/settings/appearance` the header keeps one row of actions: restore defaults and import join the theme menu, and save as theme stays a button. The high-contrast segment of the scheme control reads `Contraste` (`scheme.high-contrast.short`). The mark of the chosen theme measures whole pixels. A theme's description keeps its two reserved lines (appearance studio spec). |

## Cross-cutting questions

- R5: The texts of `settings.summary.security`, `.appearance`, `.members`, `.market_data` and `.assistant` shorten in pt-BR and en; `scheme.high-contrast.short` is new.
- R1 to R4, R6, C1 to C4, T1, T2: Does not apply.
- B1 to B3, D1 to D5, S1: Does not apply: no table, operation, setting or data written.
- S2: Phone routes `/settings` and `/settings/appearance` (ADR 027 S3).
- S3: Does not apply: what the reader can do does not change.
- S4, X1, X2: Does not apply.
