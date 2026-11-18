# Monthly tax on the gains of variable income

Coverage rows E-02, E-03, E-08, E-09 and E-11 of `docs/domain/br-product-coverage.md`; phase 6 of `docs/specs/2026-11-18-assistant-parity-and-br-instruments-design.md`. Issue andrelopes-code/equori#56.

## 1. Goal

For each month of a year, equori states the income tax a Brazilian individual owes on the gains of the sales of stocks, ETFs, BDRs, options and FII units: the base after the exemption and the losses carried, the rate, the tax withheld at source and the amount of the DARF. The month is read, never stored: it is computed from the realized results and the sales of the ledger each time it is asked.

## 2. Rules

| ID | Rule | Basis |
|---|---|---|
| GT1 | Three pools: ordinary operations (`swing` results of the classes `stock`, `etf`, `bdr`, `option`) at 15%; day trade (`day_trade` results of the same classes) at 20%; FII and Fiagro (class `fii`, both kinds) at 20%. Other classes stay out: their tax is withheld at source or follows another rule. | Lei 11.033/2004 art. 2; Lei 8.668/1993 art. 18 (FII); IN RFB 1.585/2015 art. 56 and 65. |
| GT2 | A month whose gross sales of class `stock` in ordinary operations total R$ 20,000.00 or less exempts the positive result of those sales; their losses still count. | Lei 11.033/2004 art. 3, I; RFB, Perguntas e Respostas IRPF (the loss of an exempt month is compensable). |
| GT3 | Each pool carries its own loss to later months, years included, and spends it against its own gains first. | IN RFB 1.585/2015 art. 60 and 65 §8. |
| GT4 | The tax is the base times the rate, rounded half to even to the cent. The tax withheld at source on the sales of the pool (recorded as `taxes` of the sale) is deducted; an excess carries to the next month of the same year. | IN RFB 1.585/2015 art. 61 and 65. |
| GT5 | The DARF of a month adds the tax due of the three pools and any amount carried; a total below R$ 10.00 is carried to the next month instead of paid. | Lei 9.430/1996 art. 68. |
| GT6 | A sale with both a day-trade and an ordinary part splits its gross value and its withheld tax between them in proportion to their quantities. | The ledger records one gross and one withheld tax per sale. |
| GT7 | A region without these rules returns no month. | |

## 3. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The pools, rates, exemption and minimum DARF are Brazilian: `Jurisdiction.GainTax` of `internal/portfolio/jurisdiction/br`. |
| R2 | Another region returns no month (GT7). |
| R3 | Does not apply: no value set is stored. |
| R4 | `Jurisdiction.GainTax` is an extension point; `docs/contributing/regions.md` gains its row. |
| R5 | No screen text in this slice; the tool returns codes and amounts. |
| R6 | Does not apply. |
| C1 | Every amount is an integer of minor units of the base currency. |
| C2 | The realized results hold the base currency; a sum mixes no currency. |
| C3 | The results are in the base currency of the book. |
| C4 | Does not apply: no screen. |
| T1 | A month is the month of the sale date; the year is the tax year of the jurisdiction. |
| T2 | Does not apply: the due date (the last business day of the next month) is stated in the guide, not computed. |
| B1 | Does not apply: no table. |
| B2 | `get_tax_year` keeps its role (`read`). |
| B3 | Does not apply. |
| D1 to D5 | Does not apply: nothing is stored. |
| S1 | No new operation; `get_tax_year` gains the view `gain_tax`. |
| S2 | Does not apply. |
| S3 | The guide article `equities_br` describes the computation. |
| S4 | `get_tax_year` view `gain_tax` returns the months. |
| X1 | S628 an exempt month with a loss carried, S629 a day trade with tax withheld and a DARF below the minimum carried. |
| X2 | `TestGainTaxOutsideBrazil` reads no month in a book of another region. |
