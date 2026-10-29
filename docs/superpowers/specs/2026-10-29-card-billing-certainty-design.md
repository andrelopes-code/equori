# Card billing certainty: provisional statements and the open bill (amendments A136 to A138)

Amends the billing, amount due and settlement rows of `docs/domain/05-domain-model.md` (T04, A86, A89, A90) and the matching rules of `2026-10-20-record-matching-design.md` (A98 to A101).

## Intent

Two divergences between equori and the Nubank app were measured on 2026-10-29, the closing day of the Nubank Gold statement 2026-11 (closing 2026-10-29, due 2026-11-05).

| Screen | equori | Institution | Difference | Cause |
|---|---|---|---|---|
| Closed statement 2026-11 | 1,245.78 | 1,238.65 | 7.13 | A manual charge of 2026-10-28 billed by the institution on the next statement |
| Open statement 2026-12 | 1,592.37 | 353.72 | 1,238.65 | The open amount includes the closed statement not yet due (1,245.78), and lacks the 7.13 above |

Evidence for the first row, from the institution's OFX file `Nubank_2026-11-05.ofx` (`DTSTART` 2026-09-28, `DTEND` 2026-10-29, `BALAMT` −1,238.65):
- The institution dates each Uber line one day after the ride: the ride of 2026-10-23 (7.13) is the line of 2026-10-24; the ride of 2026-10-27 (11.12) is the line of 2026-10-28.
- The ride of 2026-10-28 (7.13) posted on 2026-10-29, the closing day, so the institution billed it on statement 2026-12. On 2026-10-28 the institution's open bill showed 1,245, the 7.13 included as an authorization.
- Apart from that posting, the amounts of both statements are equal as multisets, except two cancellation pairs equori holds (charge and reversal on one statement, sum zero) and one rounding difference: the OFX line of the IOF reads 19.87, the charge is 19.88 (3.5 % of 567.86 = 19.8751), and `BALAMT` agrees with 19.88. The lines of the file sum to 1,238.64.

## Research: how card cycles behave across institutions and countries

| Fact | Source | Consequence for equori |
|---|---|---|
| A charge is billed by its posting date, not its transaction date. A purchase before the closing date posts after it when the merchant settles late. | [TD](https://www.td.com/us/en/personal-banking/learning/borrowing-credit/how-do-credit-card-billing-cycles-work), [Citi](https://www.citi.com/credit-cards/understanding-credit-cards/what-is-a-credit-card-closing-date) | The statement of a charge dated in the last days of a cycle is a prediction until the institution reports its line or its bill. |
| The lag between use and posting is usually two to three days, sometimes weeks or months; foreign merchants lag more. | [crexgroup (JP)](https://crexgroup.com/ja/creditcard/management/credit-card-usage-date-delay/) | No fixed window covers every case; the institution's bill is the only final answer. |
| Deferred debit cards (France) group operations up to a cut-off date (`date d'arrêté`), each bank with its own calendar; later operations move to the next debit. | [Caisse d'Epargne](https://www.caisse-epargne.fr/faq-particuliers/cartes/utilisation-de-ma-carte-de-paiement/quand-le-debit-differe-est-il-preleve/), [La Banque Postale](https://www.labanquepostale.fr/particulier/comptes-et-cartes/services-de-cartes/service-debit-differe.html) | The same model applies to any account with a cycle and a cut-off, not only to credit cards. |
| An authorization amount can differ from the settled amount (tips, fuel, hotels, incremental authorizations, partial reversals); some issuers show the increment as a second pending line. | [Authorization hold](https://en.wikipedia.org/wiki/Authorization_hold), [Toast](https://support.toasttab.com/en/article/Get-Help-With-Guest-Charge-Amount-Issues) | A manual or pending amount is also a prediction; the line corrects it (A101 already does). |
| A pending record can disappear and return as a posted record with a new identifier; some institutions send no pending records. | [Plaid](https://plaid.com/docs/transactions/transactions-data/) | Confirmation cannot rely on a stable record identifier between pending and posted. |
| Pluggy reports open-bill transactions as `PENDING` without `billId`; the `billId` arrives when the bill closes. Some institutions return no bill until it closes or is overdue. | [Pluggy installments](https://v2.docs.pluggy.ai/en/docs/products/credit-card-installments), [Pluggy FAQ](https://docs.pluggy.ai/docs/considerations-faq) | The institution's statement of a charge is known only after closing, and only for sources that report bills. |
| In Brazil a foreign purchase is converted at the rate of the purchase date (BCB Circular 3.918, 2020); elsewhere the rate of the posting date can apply. | [Tecnoblog](https://tecnoblog.net/327297/cartoes-de-credito-cobranca-dolar-dia-da-compra/) | The settled amount of a foreign charge can change at posting; handled by the line correction, no regional value needed. |
| Exported files can round a line differently from the institution's total. | `Nubank_2026-11-05.ofx` above | The institution's reported total is authoritative over the sum of its lines; a residual difference is shown, never absorbed. |

## Rules

### A136: provisional statement, settled by the institution

Each card posting stores its **statement basis**, the source that chose its statement:
- `date`: the first statement closing after the posting's date (T04, A86);
- `owner`: a statement the owner chose (explicit statement of T04, or the move of A137);
- `institution`: the bill a line states (A39), applied on import, on update or on match.

A correction keeps the previous basis unless it changes the statement. The migration sets `date` on every existing posting: ledger never reads ingestion tables, so the basis `institution` appears from the next line that states a bill. Until then a posting of a closed, unreconciled statement dated in its last 10 days shows as provisional, which is the signal A137 needs.

A card charge or credit has a **provisional** statement while all of the following hold:
1. its basis is not `institution`;
2. its statement has no statement reconciliation (`ReconcileStatementPostings`);
3. it is dated within `MatchHardLimit` (10) days before its statement's closing date.

Every other billed posting has a **settled** statement. Provisional is derived from the stored basis, never stored itself.

The assignment rule of T04 and A86 is unchanged: an explicit statement, else the line's bill, else the first statement closing after the date. Two changes follow:
- **The institution's bill wins on matching.** When a matched line states its bill, the posting moves to that statement, whatever its origin (manual, capture, import). The automatic match of an import already applies it (`billMatched`, `internal/ingestion/internal/app/importer.go`). The owner's match from the review queue (`review.go`, action `match`) does not: it keeps the predicted statement. A136 applies the line's bill there too.
- **The owner can choose.** The card purchase forms show the predicted statement. When the date makes it provisional (condition 3), the form also offers the next statement. The explicit statement of T04 records the choice. A posting with an explicit statement chosen by the owner stays provisional until a line or a reconciliation settles it.

### A137: a closed statement explains its difference

When a closed statement holds an institution total (a fact from an aggregator bill, a file's declared balance, or the owner, A90) and its amount due differs from it:
1. equori searches the statement's provisional postings for subsets whose sum equals the difference with the sign that moves them to the next statement;
2. among equal-sum subsets, the one with the latest dates wins, since late postings are the ones that roll over; ties among equal amounts and equal dates are interchangeable;
3. a subset found is proposed on the statement page as one action: "Mover para a fatura seguinte". The owner confirms it. equori never moves a manual posting without confirmation;
4. no subset found: the page shows the difference, the provisional postings and the institution total; a difference of at most the number of lines in minor units is labelled as a possible rounding difference of the source.

A pending imported posting keeps A90 (it moves automatically); A137 covers the cleared and manual ones.

The search is bounded: at most 20 provisional postings per statement enter it, the latest first; beyond that the page lists them without a proposal.

### A138: amount of an open statement

The statement table, the card tile and the chart show for an open statement its **open amount**:

open amount = amount due − unpaid amount of the previous statement, when the previous statement is `closed` or `partially_paid` (not yet due).

When the previous statement is `overdue`, its unpaid amount stays in the open amount, as the institution carries it. Amount due keeps its meaning (the card balance at closing, A89) and its use in settlement. `api/openapi.yaml`, `StatementSummary` and `StatementDetail`: add the required `open_amount` (Money), computed for every statement by the same formula; the web reads it for open statements.

Checks with the data of 2026-10-29 after A137 moves the 7.13:
- before payment: 1,238.65 + 353.72 − 1,238.65 = 353.72;
- after a payment of 1,238.65 on 2026-11-03: amount due 353.72, unpaid previous 0, open amount 353.72;
- after a partial payment of 1,000.00: amount due 592.37, unpaid previous 238.65, open amount 353.72.

## Regions

The rules use dates, lines, bills and totals. Every source provides these concepts: files of any format, any aggregator, any country. No regional value and no extension point is introduced; `docs/contributing/regions.md` is unchanged. `MatchHardLimit` is an existing value, not regional.

## Scenarios

| ID | Scenario |
|---|---|
| S176 | A card closes on day 29. A manual charge of 7.13 is dated 2026-10-28. Its statement 2026-11 is provisional. The line of 2026-10-29 states the bill due 2026-12-07 and matches the charge. The charge moves to statement 2026-12 and is settled. |
| S177 | Statement 2026-11 closes with an owner fact of 1,238.65 and an amount due of 1,245.78. Its provisional postings include the manual 7.13 of 2026-10-28 and an imported cleared 7.13 of 2026-10-23. The proposal moves the posting of 2026-10-28. After the move, amount due equals the fact. |
| S178 | A manual charge of 50.00 dated 2026-10-27, explicit statement 2026-12 chosen by the owner, stays on 2026-12 when statement 2026-11 closes. |
| S179 | A closed statement differs from its file total by 0.01 and has no provisional posting of 0.01. The page shows the difference as a possible rounding difference; no posting moves. |
| S180 | Statement 2026-11 closed (due 2026-11-05) with 1,238.65 unpaid; statement 2026-12 open with charges 353.72. Open amount is 353.72. On 2026-11-06, unpaid, statement 2026-11 is `overdue` and the open amount is 1,592.37. |

## Out of scope

- Interest and fees on an overdue statement.
- Automatic moves of manual postings without the owner's confirmation.
- A per-card posting lag learned from history.
