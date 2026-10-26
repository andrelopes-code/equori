# Text capture

Amendments A106–A118 and A128, and scenarios S99–S113 and S151–S153 of `docs/domain/06-scenarios.md`.

## Intent

Recording a purchase through the form takes one screen per transaction. A capture is a block of text the owner writes, one transaction per line, such as `ontem mercado 230 nubank`. The server reads each line with a fixed grammar and returns one draft per line. The owner corrects the drafts and records all of them in one request. Nothing is recorded before that request, and a line the grammar cannot read is reported with its reason, never guessed.

## A106 Module

A new module `capture` (`internal/capture`) owns the grammar. It has no tables. It reads the ledger vocabulary (accounts, institutions, cards, payees) through `ledger.Module` and the payee and category decision through `classification.Module`. It records nothing: recording goes through the ledger batch of A114.

`POST /capture/preview` takes `{text, default_account_id?}` and returns one `CaptureLine` per non-blank line. The operation is read-only and idempotent. `text` holds at most 10,000 characters and 100 non-blank lines; more returns 400 from the contract (C3) or 422 `too_many_lines`.

## A107 Lines and segments

A line ends at a line break or at `;`. Blank lines are skipped; `line` is the 1-based number of the line in the split text. A comma never splits a line, because it is the decimal separator of pt-BR.

Each line is cut into words at whitespace. Matching is case-insensitive and accent-insensitive: the text is lower-cased and folded with the normalization of classification (A26). Each recognized phrase becomes a segment with a role: `amount`, `date`, `installments`, `account`, `kind`, `tag`, `text`. The concatenation of the segments' `text` equals the line, so the client draws the line with its recognized parts marked and no offsets travel.

## A108 Amounts

An amount phrase is a number with an optional `R$` prefix (joined or separated by a space), an optional sign (`+` or `-`), and an optional multiplier suffix (`k`, or the word `mil`).

| Number form | Reading | Example |
|---|---|---|
| digits, optional `,` and decimals | comma is the decimal separator | `45,9` = 45.90 |
| 1–3 digits, then groups of `.` and 3 digits, optional `,` and decimals | dots separate thousands | `1.234,56` = 1,234.56 |
| digits, `.`, 1 or 2 digits, no comma | the dot is the decimal separator | `12.5` = 12.50 |

A word that mixes digits and letters other than the multiplier (`24h`, `4g`, `99pop`) is text. A phrase with more decimal places than the instrument's scale, a zero amount, or an amount above 999,999,999.99 is issue `invalid_amount`.

A phrase with `R$`, a sign, a multiplier or the word `reais` is explicit. The line's amount is the only explicit phrase; without one, the only number left after A109 and A110. Numbers beside an explicit phrase stay in the description. Two or more explicit phrases, or no explicit phrase and two or more numbers, give issue `ambiguous_amount`; each choice carries the amount and the description the line has when that amount is chosen. No number gives `missing_amount`. The scale is the one of the line's account instrument, or of the base currency without an account.

## A109 Dates

| Phrase | Date |
|---|---|
| `hoje`, `today` | today |
| `ontem`, `yesterday` | today − 1 |
| `anteontem` | today − 2 |
| weekday (`segunda` … `domingo`, with or without `-feira`; `monday` … `sunday`) | the latest such day on or before today |
| `dia D` | day D of the current month when D ≤ today's day, otherwise of the previous month |
| `D/M` | that day of the current year when not after today, otherwise of the previous year |
| `D/M/YY`, `D/M/YYYY`, `YYYY-MM-DD` | that date; `YY` is 20YY |

A day that does not exist in its month (`31/02`, `dia 31` in a 30-day month) is issue `invalid_date`. Two date phrases give `ambiguous_date`. Without a phrase the date is today. Only the explicit year forms reach a future date.

## A110 Installments

`Nx`, `N x`, `em Nx`, `N vezes`, `N parcelas`, `parcelado em N` with N from 2 to 420 set the installment count; `1x` and `à vista` set none. A count of 0 or above 420, or two installment phrases, is issue `invalid_installments`. When the phrase is followed by `de` and an amount (`3x de 19,90`), that amount is one installment, the total is N times it, and the phrase counts as an explicit amount (A108); otherwise the line's amount is the total. Installments require a credit card account and kind `expense`; otherwise issue `installments_not_allowed`.

## A111 Accounts

The candidates are the open asset and liability accounts without children and without a system role. Each candidate has handles: its name, its institution's name, and for a card account `final NNNN` and `*NNNN` of each active card. A mention is the longest contiguous word sequence equal to a handle; a mention names the set of accounts that carry the handle.

A method word narrows a mention, or names a set when no account is mentioned:

| Words | Accounts |
|---|---|
| `crédito`, `credit` | kind `credit_card` |
| `débito`, `pix`, `ted`, `debit` | asset accounts of kinds `checking`, `savings`, `wallet` |
| `dinheiro`, `espécie`, `cash` | kind `cash` |
| `cartão`, `card` | kind `credit_card`, unless another method word is present, which then decides |

A set of one account resolves with source `text`. A larger set gives issue `ambiguous_account` with the accounts as `choices`; an empty set gives `unknown_account`. Method words of two groups narrow nothing; without a mention they give `ambiguous_account` with every candidate. A line with method words and no mention takes the default account when the default is in the method's set. A line without a mention and without a method word takes `default_account_id` with source `default`, and without it gives `missing_account`. An unresolved account has no source. `default_account_id` that is not a candidate is a 422 on the field. Method words narrow a single mention only; a transfer ignores them.

## A112 Kind

| Line | Kind | Accounts |
|---|---|---|
| two mentions | `transfer` | the mention after `para`, `pra`, `pro`, `p/`, `->`, `→`, `to` is the destination; the other the source |
| one mention after a destination word | `transfer` | the default account is the source |
| one mention, a transfer word (`transferi`, `transferir`, `transferência`, `transf`, `transfer`), no destination word | `transfer` | the mention is the source; issue `missing_destination` |
| no mention, a transfer word | `transfer` | the default account is the source; issue `missing_destination` |
| `recebi`, `recebido`, `ganhei`, `received`, `income`, or an amount signed `+` | `income` | the mention or the default |
| anything else | `expense` | the mention or the default |

Of two mentions, the one after a destination word is the destination; without one, the mention after a source word (`de`, `do`, `da`, `from`) is the source. Two mentions that neither rule orders give `ambiguous_transfer`; three or more give `too_many_accounts`; a source equal to the destination gives `same_account`; accounts of different instruments give `currency_mismatch`. The words `gastei`, `paguei`, `comprei`, `spent`, `paid`, `bought` are consumed with role `kind` and change nothing.

## A113 Description, payee, category and tags

`#word` is a tag of 1 to 60 characters; a repeated tag counts once. The words left as `text` form the description: joined by one space, with the connectors `de`, `do`, `da`, `dos`, `das`, `no`, `na`, `nos`, `nas`, `em`, `com`, `para`, `pra`, `pro`, `por` removed from both ends and the first letter upper-cased. For an expense or income line with an amount and an account, classification decides payee, tags and category with its precedence (F5: aliases, rules, payee history) for origin `manual`. When no alias resolves a payee, a payee whose normalized name equals the normalized description is the line's payee and enters the decision, so its rules and payee history apply; a name two payees share names none. A decision of a split or of a transfer leaves the category empty. `category_source` is `rule` or `history`. A line without a category records against the uncategorized account of its sign, and the recorded event runs classification again (P5 A20).

## A114 Transaction batch

`POST /transaction-batches` takes `{entries[]}`, 1 to 100, each holding exactly one of `transaction` (a `TransactionInput`) or `installment_purchase` (an `InstallmentPurchaseInput`). All entries are recorded in one database transaction with origin `manual`, or none is. A rejected entry returns 422 whose field is prefixed `entries[i].transaction.` or `entries[i].installment_purchase.`; an entry with both or neither member is 422 `validation_failed` on `entries[i]`. The response is 201 with `{items[]}`, the created transactions in input order. Each entry publishes the event its single operation publishes.

## A115 Capture screen

`/transactions/capture` is the second form of `/transactions/new`; each page links to the other, and `N` and the dock open the one used last. The screen holds a default account field, the text field and one draft per line. A draft shows the line with its segments marked, the kind, amount, date, accounts, installments, payee and category, the source of each decided field, and each issue with its choices as buttons. Choosing a choice or editing a draft stores an override keyed by the line's text and its occurrence among equal lines; changing the text of a line drops its override. `Registrar N` records every draft through A114 and is enabled only when no draft has an issue. The drafts on screen answer the text once the reading caught up with it; until then the list is busy and Record is disabled. After recording, the text and overrides clear and a toast links to the transactions. A refused entry (A114) is shown on its line and nothing is recorded. The text and the overrides survive leaving the page in the tab's session storage (FM-05); the default account and the form used last are kept in local storage. An override's edit uses the transaction form, plus the installment count for a card expense.

## A116 Exposure

`previewCapture` is excluded from the tool registry with reason `-capture` and `createTransactionBatch` with `-write` (ADR 012 T14): the preview serves the screen's typing loop, and a write tool needs the confirmation design of a consuming agent, which no agent has yet. Both are operations of the admin console (`web/src/features/admin/operations.ts`).

## A117 Near account names

A free word of five or more letters at edit distance 1 (insertion, deletion, substitution or transposition of adjacent letters) from a single-word handle of five or more letters is near that handle. When a line takes its source account by default, or names none, and exactly one word is near, the line gets issue `possible_account` instead of the silent default or `missing_account`. Its choices are the accounts of the near handle, with the description without that word, and the default account, with the description as written. In a transfer, a near word after a destination word asks for the destination in place of `missing_destination`. A line that names its account keeps it, and a near word stays text.

## A118 Category suggestions

A draft that classification left without a category is offered a language model's category under ADR 014: `POST /capture/suggestions` takes up to 40 descriptions with their kind and answers one suggestion each, from kept answers or one model call, with `available: false` when the model cannot be asked. The screen asks once the text has been still for 1.2 seconds, shows the category with "suggested by AI" and records it unless the owner changes it. The text is written in the application's prompt composer, ringed by a halo of the data hues that turns while the composer is in use or the drafts are on their way.

## A128 Reference date

`POST /capture/preview` takes an optional `reference_date`, and every date phrase of the text resolves against it instead of the instance's today; without it, against today. A date after today plus one day returns 422 `validation_failed` with a field error on `reference_date`, because the device that wrote the text may sit one day east of the instance's zone (distribution design, P6).

| Scenario | Text | `reference_date` (today 2026-10-21) | Result |
|---|---|---|---|
| S151 | `mercado 30 ontem` | 2026-10-18 | date 2026-10-17 |
| S152 | `mercado 30` | 2026-10-18 | date 2026-10-18 |
| S153 | `mercado 30` | 2026-10-22, then 2026-10-23 | date 2026-10-22, then 422 `validation_failed` on `reference_date` |

## Out of scope

Shared expenses and reimbursements (S18, S19), statement payments (S10), foreign purchases (S16), and language model reading of anything other than the category. A line that needs them records as an expense or is corrected after recording.

## Scenarios

Today is 2026-10-21 (a Wednesday). Accounts of the fixture (6.1); Nubank checking and Itaú Visa have institutions Nubank and Itaú; Itaú Visa has an active card ending 1234. A rule sets Food › Supermarket for descriptions containing `mercado`.

| ID | Text | Outcome |
|---|---|---|
| S99 | `ontem mercado 230 nubank checking` | expense 230.00 on 2026-10-20 from Nubank checking, description `Mercado`, category Food › Supermarket by `rule` |
| S100 | `uber 32,50 itaú; ifood 58 3x final 1234` | two lines; the second is an expense of 58.00 on Itaú Visa in 3 installments |
| S101 | `notebook 3x de 1.200 itaú` | total 3,600.00 in 3 installments |
| S102 | `transferi 500 do nubank checking pra wallet` | transfer 500.00 from Nubank checking to Wallet |
| S103 | `recebi 1.5k nubank checking` | income 1,500.00 to Nubank checking |
| S104 | `padaria 2 irmãos 15` | issue `ambiguous_amount` with choices 2.00 and 15.00 |
| S105 | `cinema 40` with no default account | issue `missing_account`; with default Wallet, source `default` |
| S106 | `almoço 32 nubank` (institution of one account) | Nubank checking; `almoço 32 itaú débito` gives `unknown_account` |
| S107 | `sexta 12,99 wallet` | 2026-10-16 |
| S108 | `31/02 50 wallet` | issue `invalid_date` |
| S109 | `mercado 45 3x wallet` | issue `installments_not_allowed` |
| S110 | `taxi 30,999 wallet` | issue `invalid_amount` |
| S111 | Batch of S99 and S100 | 201 with three transactions; the second carries an installment plan |
| S112 | Batch whose second entry names a closed account | 422 on `entries[1].transaction.postings[0].account_id`; no transaction recorded |
| S113 | `almoço 30 nubnak` with default Wallet | issue `possible_account` with choices Nubank checking ("Almoço") and Wallet ("Almoço nubnak") |
