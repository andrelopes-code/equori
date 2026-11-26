# Schedule terms revision (A269)

Defect: a terms version is only added after the latest one (`POST /schedules/{id}/terms`). A version saved with a wrong date or amount stays. Schedule `01a205e6-e4ea-7657-b1a1-3bd5e014abbb` holds 80.00 from 2026-12-05 (first version) and 100.00 from 2026-12-06; the 100.00 was meant for 2026-12-05, which no new version can reach.

## Rules

| ID | Rule |
|---|---|
| TR1 | `PUT /schedules/{id}/terms/{effective_from}` replaces the latest version. Absent amount or recurrence keeps the value of the replaced version. The new date is after the previous version. |
| TR2 | The first version keeps its date and its recurrence when replaced: only its amount changes. A date or a recurrence on the first version is 422 on the field. Start earlier moves its date; a new version changes its recurrence. |
| TR3 | `DELETE /schedules/{id}/terms/{effective_from}` removes the latest version; the previous one applies again from that date. The first version is never removed: 409 `terms_first`. |
| TR4 | A date that is not the latest version's: 409 `terms_not_latest`. |
| TR5 | Expected occurrences that were not moved, from the earlier of the old and the new date on, are deleted and regenerated (A52 as in ChangeTerms). Realized, skipped and moved occurrences never change. |
| TR6 | Replacing with a date on or after ends_on: 409 `schedule_ended`. |

## Cross-cutting questions

- R1: Does not apply: no regional value.
- R2: Does not apply: no regional value.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: Keys `schedule.terms.actions`, `schedule.terms.revise`, `schedule.terms.reviseHint`, `schedule.terms.remove`, `schedule.terms.removeTitle`, `schedule.terms.removeHint`, problem texts `terms_first`, `terms_not_latest`; pt-BR and en.
- R6: Dates through `formatDate`, amounts through `useMoneyFormat`, as the terms table does.
- C1: The amount of a version: minor units with the schedule currency, as ChangeTerms.
- C2: Does not apply: no sum.
- C3: Does not apply: the version holds the schedule currency.
- C4: The currency comes from the version.
- T1: The effective date is a calendar date; today comes from `platform/clock` for the regeneration start.
- T2: Business days come from the schedule calendar, as ChangeTerms.
- B1: Does not apply: no table.
- B2: Both operations declare `write`; `identity.Authorize` enforces the role for every operation (`TestBookRoleDeclared`).
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: a terms version is a plan, not a recorded fact; realized occurrences never change (TR5).
- D4: Does not apply: user input only.
- D5: Does not apply.
- S1: `reviseScheduleTerms`, `removeScheduleTerms` map to `manage_schedule`, actions `revise_terms` and `remove_terms`. Problem codes `terms_first`, `terms_not_latest` tested through the HTTP API.
- S2: The schedule screen on a phone shows the same row menu.
- S3: `schedules_and_occurrences.md` states both actions.
- S4: list_schedules already returns the versions; manage_schedule writes the revision.
- X1: S741 (revise latest), S742 (revise first amount), S743 (remove latest; first refused; not latest refused); `TestManageScheduleReviseAndRemoveTerms` covers the tool.
- X2: Does not apply: R1, R2, C2, C3 do not apply.

## Tasks

1. Backend: service ReviseTerms and RemoveTerms, query DeleteTerms, handlers, openapi, `make gen`, manage_schedule actions, apitest S741 to S743, exposure entries, domain docs, guide article. Commit `fix(planning): revise or remove the latest terms version`.
2. Web: terms table extracted from the schedule page with a row menu on the latest version, TermsDialog in revise mode, remove confirmation, catalog keys. Commit `fix(web): revise or remove the latest terms version of a schedule`.
