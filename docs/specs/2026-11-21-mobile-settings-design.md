# Mobile settings

Status: approved 2026-11-21 (owner delegated the design decisions of the phone redesign). Wave 4 of the phone redesign.

Below 600 px the index of `/settings` holds one row per section, each of one height: the section's icon, its name, one line that says what it holds, and the arrow onward.

## Rules

| ID | Rule |
|---|---|
| ST1 | A group of the settings navigation whose every section is hidden from the reader (the system group for a member who is not an administrator) draws no label, at every width. |
| ST2 | Each row's summary holds one line and cuts with an ellipsis at the row's end. The summaries of security, appearance, members, market data and the assistant read in at most 41 characters, so none cuts at 360 px. |

## Cross-cutting questions

- R5: The texts of `settings.summary.security`, `.appearance`, `.members`, `.market_data` and `.assistant` shorten in pt-BR and en; no key is added.
- R1 to R4, R6, C1 to C4, T1, T2: Does not apply.
- B1 to B3, D1 to D5, S1: Does not apply: no table, operation, setting or data written.
- S2: Phone route `/settings` (ADR 027 S3), kind "Index" (mobile.md M1).
- S3: Does not apply: what the reader can do does not change.
- S4, X1, X2: Does not apply.
