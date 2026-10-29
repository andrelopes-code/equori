# Review keeps up with the ledger (amendment A140)

Amends the review of `2026-10-20-record-matching-design.md` (A98 to A101).

## Intent

A bank line that arrives before the entry it confirms waits for review with no candidate: the candidates were computed once, at import. On 2026-10-29 the owner's Nubank Gold held such a line, the refund "Estorno de compra" of 2026-09-18 (496.67), imported on 2026-10-18; the cancellation it confirms was recorded on 2026-10-20. The review still offered nothing, so the line was discarded, and nothing could link it again.

## Rules

- **Fresh candidates.** A record in review is scored against the postings of its account that no record links now, within `MatchHardLimit` days of its date, whenever it is read or resolved. A transaction recorded after the import is offered; one linked since is not. Resolving keeps accepting the candidates stored at import, so a choice the ledger now refuses (a voided or reconciled entry) is refused by its own rule.
- **Reopen.** A discarded record returns to review (`POST /external-records/{id}/reopen`, tool `manage_imports` action `reopen_record`), with fresh candidates; the batch moves it from discarded to needs review. A record that is not discarded returns `record_not_discarded` (409).

No regional value and no extension point; `docs/contributing/regions.md` is unchanged.

## Scenarios

| ID | Scenario |
|---|---|
| S182 | A −50.00 line waits for review with two candidates. The owner records a third −50.00 entry on the same day; the review offers it, and matching it links the line. |
| S183 | The owner discards the line of S182, then reopens it: it waits for review with its candidates, the batch counts it in review, and it can be matched. Reopening it again returns `record_not_discarded`. |
