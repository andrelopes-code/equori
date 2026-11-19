# Redemption tax in the fixed income calculators

- Date: 2026-11-19
- Status: approved by the owner on 2026-11-19 (choice delegated: "escolha")
- Amends: `docs/specs/2026-10-26-calculators-design.md` §7 ("below 30 days: no result"); `docs/specs/2026-11-17-indexer-comparison-design.md` IC3
- Web features: `calculators/fixed-income-calculator`, `calculators/indexer-comparison`

## 1. Intent

The calculators `fixed-income` and `indexer-comparison` refuse a holding below 30 days in Brazil: the screen states that IOF applies and computes nothing. Three public calculators compared on 2026-11-19 (AUVP, ValorFinal, Meus Dividendos) compute it in one case only (ValorFinal, date mode). The ledger already withholds it (`internal/ledger/domain/withholding.go`). The calculators compute it with the same rule.

## 2. Evidence

| Fact | Source |
|---|---|
| IOF is 1% a day on the redemption value, limited to the yield, by the days of the Anexo: 96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3 percent for days 1 to 29, 0 from day 30. | Decreto 6.306/2007, art. 32 and Anexo, consolidated text of the Câmara dos Deputados, read 2026-11-19 |
| It applies to the fixed income market (§ 1º, I). LCA, CRA, CDCA (§ 2º, V), debentures, CRI and letras financeiras (§ 2º, VI) take a zero rate. | Same, art. 32 §§ 1º and 2º |
| The income tax base is the redemption value net of IOF less the amount applied. | Lei 8.981/1995, art. 65, § 1º |
| The ledger table of the same rule: `WithholdingTable.IOF`, IOF on the gain, then income tax on the gain less the IOF, each rounded. | `internal/ledger/domain/withholding.go:29-60` |

## 3. Approaches

| Approach | Fails on |
|---|---|
| A. No change | A holding of 1 to 29 days has no answer in Brazil. |
| B. The region rule folds IOF into the tax share | The figure "Tax" hides IOF; one rounding differs from the ledger's two by one minor unit. |
| C. The region rule returns a redemption tax beside the income tax; the maths applies both in the ledger's order (chosen) | One more figure on the answer when it is above zero. |
| D. Read the rate from the backend | A request per keystroke for a 29-row table; the calculators are client-side (calculators design §4). |

## 4. Rules

- RT1. `FixedIncomeRules.redemptionBp(days)` returns the tax on the yield of a redemption after `days` calendar days, in basis points; it replaces `minimumDays`. BR: the Anexo of §2 for days 1 to 29, 0 from day 30. DE and PT: 0. The BR rule records its check on 2026-11-19 and lists both sources of §2.
- RT2. `fixedIncome` takes `redemptionBp`: `redemption = round(gross × redemptionBp / 10000)`, `tax = round((gross − redemption) × taxBp / 10000)`, `net = gross − redemption − tax`, half-even rounding.
- RT3. A security marked exempt pays neither tax. A taxed security pays both.
- RT4. The share used by the equivalent rate and by the break-even is `redemptionBp + taxBp × (1 − redemptionBp / 10000)`: both taxes are shares of the yield, the second on what the first leaves.
- RT5. The fixed-income answer lists "Redemption tax" when it is above zero; the evidence splits the gross into net, tax and redemption tax. The comparison table adds redemption tax to the tax column of its row.
- RT6. The Brazilian note of the method states the table, its order with the income tax, and the zero rate of art. 32 § 2º for LCA, CRA, CDCA, debentures, CRI and letras financeiras.

Cases (tests of RT1 and RT2): BR day 1: 9600; day 29: 300; day 30: 0. Amount 1,000,000 minor units at 12% for 20 days, taxed, BR: gross 6229, redemption 2056 (33%), tax 939 (22.5% of 4173), net 3234.

## 5. Cross-cutting questions

- R1: The redemption tax varies by country; extension point `fixedIncomeRules` (existing row of `docs/contributing/regions.md`).
- R2: A region without a case asks for the income tax rate and applies no redemption tax, as today.
- R3: Does not apply: no value set.
- R4: Does not apply: no new extension point; the row of `fixedIncomeRules` gains the redemption tax.
- R5: Keys `calc.fixedIncome.redemption`, `calc.fixedIncome.split.redemption`, `calc.fixedIncome.redemptionShare`, `calc.fixedIncome.br.iof` in en and pt-BR; `calc.fixedIncome.iof` is removed.
- R6: Amounts through `money.format`, rates through `formatRate`, days through `numberFormatter`, as today.
- C1: Minor units, integers after rounding (RT2).
- C2: Does not apply: one currency per calculation.
- C3: Does not apply: no change to currencies.
- C4: Does not apply: no new currency source.
- T1: Days are the calendar days the calculators already count.
- T2: Does not apply: the Anexo counts calendar days.
- B1 to B3: Does not apply: no table, operation or setting.
- D1 to D5: Does not apply: nothing stored.
- S1: Does not apply: no operation.
- S2: The calculators keep their phone scope.
- S3: `internal/assistant/guide/articles/investments.md`, paragraph "Comparing indexers", states the redemption tax.
- S4: Does not apply: the assistant reads the IOF rule in `fixed_income_br.md` already.
- X1: Does not apply: no HTTP scenario.
- X2: `fixed-income-region.test.ts` and `fixed-income-calculator.test.tsx` run DE and PT with a redemption tax of zero.
