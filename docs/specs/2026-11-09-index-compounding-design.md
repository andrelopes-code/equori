# Index compounding as an extension point

- Issue: #42
- Date: 2026-11-09

## 1. Context

`internal/marketdata/domain/terms.go` declares `IndexCDI = "cdi"`. `Terms.Validate` accepts the day count `bus252` only for that index, and `Accrue` in `accrual.go` compounds that index by business day. Every other index compounds by ended month. The Brazilian index is a rule of the domain core, against ADR 016 and the Regions section of `CONTRIBUTING.md`.

## 2. Decisions

| ID | Decision | Reason |
|---|---|---|
| IC1 | An index source declares business-day compounding through an optional interface of `internal/marketdata/index`: `BusinessDayCompounding`, method `CompoundsByBusinessDay() bool`. A source that does not implement it compounds by ended month. | ADR 016 X1 and X2: the module that consumes the rule declares it, and the region's implementation holds it. An optional interface leaves `overnight` and `cpi` untouched. |
| IC2 | `brsgs.CDI` implements it with `true`; `brsgs.IPCA` with `false`. | The rule moves with the `br` source that serves the index. |
| IC3 | The module computes the sorted index IDs of every registered source that compounds by business day, enabled or not, once in `marketdata.New`. | The rule holds today for `cdi` whether or not `br_cdi` is enabled; enabling a source must not change how stored terms accrue. |
| IC4 | The domain receives that set as a value, `domain.BusinessDayIndexes`, in `Terms.Validate` and `Accrue`. The domain names no index. | ADR 016 Consequences: `domain` imports only the standard library and `platform/money`; it holds no registry. |
| IC5 | The error of `bus252` on another index keeps its text: `bus252 counts the business days of the <ids> index; use act365`, the IDs joined by `" or "`. With the registry of today it reads `bus252 counts the business days of the cdi index; use act365`. | The change is a reorganization: no text changes. |
| IC6 | The assistant tool `manage_instrument` defaults the day count to `bus252` for an index of the set, as it does for `cdi` today. | Same behavior, no index ID in the adapter. |
| IC7 | Out of scope: the `CHECK` of `marketdata_terms` that ties `bus252` to `cdi` in the schema. | Changing it needs a migration and changes the schema test of `internal/marketdata/terms_test.go`; this issue keeps the tests unchanged. |
| IC8 | Out of scope: daily overnight indexes (`estr`, `sofr`) compound by ended month today, as every index outside the set. | Behavior stays; a change is a feature of its own. |

## 3. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Business-day compounding varies by index; its extension point is `index.BusinessDayCompounding`, implemented by `brsgs.CDI`. |
| R2 | A region without an implementation has no index in the set: every index compounds by ended month and only `act365` is accepted. |
| R3 | Does not apply: no new value set. `day_count` stays a closed `enum` (`bus252`, `act365`): day-count conventions are universal. |
| R4 | `docs/contributing/regions.md` gains the row "Index compounding". |
| R5 | Does not apply: no new text (IC5). |
| R6 | Does not apply: no screen. |
| C1 | Does not apply: no amount is stored; accrued prices keep their computation. |
| C2, C3 | Does not apply: no sum or conversion. |
| C4 | Does not apply: no screen. |
| T1 | Does not apply: no date changes. |
| T2 | The business days counted are the published days of the index rates, as today; no calendar is added. |
| B1 to B3 | Does not apply: no table, operation or setting. |
| D1 to D5 | Does not apply: no table, schema, fact, import or diagnostic field. |
| S1 to S4 | Does not apply: no operation, screen or assistant data change. |
| X1 | Does not apply: no scenario. |
| X2 | The tests of `internal/marketdata` pass with the same expected values; `TestValidateWithoutBusinessDayIndex` (plan, Task 1) runs `Validate` with an empty set, the neutral case of R2. |
