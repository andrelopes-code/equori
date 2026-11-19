# Contribution plan: groups by rule

- Date: 2026-11-19
- Status: approved on 2026-11-19 (the owner delegated the decisions to the planning session)
- Module: `portfolio`; rules GR1 to GR12; scenarios S639 to S646; issue #64
- Amends: `docs/specs/2026-11-12-contribution-plan-design.md` (CN3, CN5, CN6, CN12, API, Storage, Edit mode)
- Study: `docs/specs/2026-11-18-fixed-income-planning-study.md`, approach A1

## Intent

A member of the contribution plan names one account or one instrument (CN3). A fixed income application creates a contract with a new code (A236 FC2), so each month's purchase is an instrument no member names. CN6 then counts the contract outside the plan, and its value enters no group. A group of fixed income whose contracts are not listed reads as empty, and CN7 sends it more money than its ideal asks.

Case, with the values of GR12: three fixed income groups hold 18,000.00 in contracts no member names, and an equity group holds 2,000.00. Today the split of 2,000.00 sends 571.43, 857.14 and 571.43 to the fixed income groups and nothing to equities. Under this spec the contracts count in their groups, and the 2,000.00 go to equities, the only group below its ideal.

A group by rule names the characteristics of the securities it holds, not the securities. A contract bought after the plan joins the group whose rule it meets, with no edit of the plan. The investor plans before knowing the shelf (study, section 5).

## Goals, non-goals, anti-goals

Goals:

- G1. A group holds up to five rules. A rule is a set of conditions over the type, the subtype, the quote currency, the return kind, the maturity year, the daily liquidity and the guarantee of a security.
- G2. Each held security counts in one group at most: in the group of the member that names it, else in the first group whose rule it meets, else outside the plan.
- G3. The screen lists, under a group by rule, the securities that meet it today with their values, in the saved plan and in a draft.
- G4. "Partir da minha carteira" builds one group by rule per return kind of the fixed income held.

Non-goals:

- Recording a purchase from the plan, and the notice "fora do plano" when an application is saved (study A2).
- A reference rate per group (study A8).
- Converting the members of a saved plan to rules.
- A rule over the issuer, the rate or the tax class. The subtype list covers the tax class (LCI and LCA are subtypes).
- A split of a group by rule among its securities (CN8). A group by rule receives one amount.

Anti-goals:

- A security counted in two groups, or a security in no group and left out of the outside list.
- A rule that matches every security (a rule with no condition).
- A condition on a fact the security lacks read as met: a stock has no maturity, so a rule with a maturity year never matches it.

## Rules

**GR1 Group by rule.** A class holds members (CN3) or rules, never both. A class with rules holds 1 to 5 rules, no member, no question (CQ1) and no member target (CN4). Any other shape returns `contribution_rule_invalid`. A class with neither members nor rules stays valid: it is cash-like (CN17).

**GR2 Rule.** A rule is a conjunction of the conditions it sets, each optional:

| Condition | Value | Met when |
|---|---|---|
| `instrument_type` | a type of the catalog other than `currency` | the security has this type |
| `subtypes` | 1 to 20 distinct subtypes, `^[a-z0-9_]{2,40}$` | the security's subtype is one of them |
| `quote_currency` | a code of the catalog of type `currency` | the security is quoted in it |
| `return_kind` | `rate`, `inflation` or `fixed` | the security's return kind (GR3) is this one |
| `matures_from_year`, `matures_to_year` | a year from 1900 to 2200; from ≤ to when both are set | the year of the security's maturity (GR3) is within the bounds, inclusive |
| `daily_liquidity` | true or false | the security's daily liquidity (GR3) equals it |
| `guarantee` | `covered`, `sovereign` or `uncovered` | GR4 |

A rule sets at least one condition. `subtypes` requires `instrument_type`. `return_kind` requires `instrument_type` absent or `fixed_income`. `guarantee` requires a jurisdiction with a guarantee (FC22). Any other rule returns `contribution_rule_invalid`. The rules of one class are alternatives: a security meets the class when it meets one of them.

**GR3 Facts of a fixed income security.** The return kind, the maturity and the daily liquidity come from:

- the terms of the contract (FC4), when it has terms: return kind `fixed` without `index_id`; `inflation` when the period of its index is a month; `rate` when it is a day (FC9); maturity `matures_on`; daily liquidity `daily_liquidity`;
- the code of a Brazilian government bond (`governmentBondCode` in `internal/marketdata/government_bonds.go`), when it has no terms: `LFT` is `rate`; `LTN` and `NTNF` are `fixed`; `NTNB`, `NTNBP`, `NTNC`, `RENDA` and `EDUCA` are `inflation`; the maturity is the date in the code; daily liquidity is true for `LFT` only. The Tesouro buys back every bond on every business day at its market price. An LFT pays the overnight rate, so its market price stays near its accrued value. The price of the other bonds moves with the market rate, so a redemption before maturity can return less than was applied. "Liquidez diária" in a rule means redemption on any business day near the accrued value, which only an LFT gives.
- none otherwise: a condition on the return kind, the maturity or the daily liquidity is not met.

**GR4 Guarantee condition.** With the jurisdiction's guarantee `g` (FC22) and the subtype `s` of the security: `covered` is met when `g.Covered(s)`; `sovereign` when `g.Sovereign(s)`; `uncovered` when the security has type `fixed_income` and neither holds. `uncovered` is the private credit of the book: a debenture, a CRI, a CRA or an LF. It never includes a Tesouro bond (`sovereign`) or a stock. When the book's jurisdiction no longer has a guarantee (its region changed after the save), the condition is not met and the response omits `guarantee_name` (GR8).

**GR5 Assignment.** Each held security, the sum of its holding accounts as in CN5, goes to:

1. the class of an `instrument` member that names it;
2. otherwise the first class, in plan order, with a rule it meets;
3. otherwise the outside list (CN6).

Account members (CN3) are unchanged: a rule never meets an account of type `currency`. The facts are read at today (`platform/clock`, book time zone): a contract that matures this year still meets a rule bounded by this year.

**GR6 Value.** The value of a class by rule is the sum of the values of its securities (CN5). A security of a class by rule without a price or a rate at today makes the response `incomplete` (CN10), with that instrument in `missing`.

**GR7 Split and orders.** A class by rule is one slot of CN7. Its order is cash-like (CN17): the planned amount, with no quantity.

**GR8 Response.** Each class returns `rules` as stored, and `matched`: its securities with `instrument` and `value`, sorted by value descending, then by code. The plan returns `guarantee_name` when the book's jurisdiction has a guarantee in the base currency (as `guaranteeIn` in `internal/portfolio/app/issuer_exposure.go` decides). Each outside entry returns `return_kind` when GR3 gives one. The preview (CN13) applies GR1 to GR7 to the draft.

**GR9 Start from the portfolio (amends CN12).** Outside entries of type `fixed_income` with a return kind form one class per return kind, in order of first appearance. Each class is named by the catalog label of the kind (`portfolio.fixedIncome.kind.<kind>`). It holds one rule `{instrument_type: fixed_income, return_kind: <kind>}` and no member. Entries of type `fixed_income` without a return kind, and the entries of other types, keep CN12: one class per type, each entry a member. The targets of the classes are their shares, as in CN12.

**GR10 Storage.** Table `portfolio_contribution_rule`:

| Column | Type | Constraint |
|---|---|---|
| `books_id` | bigint NOT NULL | |
| `class_id` | uuid NOT NULL | `(books_id, class_id)` references `portfolio_contribution_class (books_id, id)` ON DELETE CASCADE |
| `position` | integer NOT NULL | 0 to 4; primary key `(class_id, position)` |
| `instrument_type` | text NULL | `^[a-z0-9_]{2,40}$` |
| `subtypes` | text[] NULL | 1 to 20 elements |
| `quote_currency` | text NULL | |
| `return_kind` | text NULL | `rate`, `inflation` or `fixed` |
| `matures_from_year`, `matures_to_year` | integer NULL | 1900 to 2200; from ≤ to when both |
| `daily_liquidity` | boolean NULL | |
| `guarantee` | text NULL | `covered`, `sovereign` or `uncovered` |

A CHECK requires at least one condition column to be set. A save replaces the rules with the rest of the plan (CN1). The rules of GR1 to GR4 that depend on the catalog or the jurisdiction are checked in `app`; the CHECKs hold the shape.

**GR11 Tools.** `save_contribution_plan` accepts `rules` per class with the conditions of GR2. `get_portfolio` view `contribution` returns `rules`, `matched`, `guarantee_name` and the outside `return_kind`.

**GR12 Hand-computed case.** Holdings at today, all in BRL, base BRL:

| Security | Facts | Value |
|---|---|---|
| CDB A (contract) | `rate`, matures 2027, no daily liquidity, subtype `cdb` | 10,000.00 |
| LCI B (contract) | `rate`, matures 2028, daily liquidity, subtype `lci` | 5,000.00 |
| `NTNB.20350515` | `inflation`, matures 2035 | 3,000.00 |
| Stock X | member of "Ações" | 2,000.00 |

Plan: "Reserva" 2000 `{daily_liquidity: true}`; "Pós" 3000 `{instrument_type: fixed_income, return_kind: rate}`; "IPCA+" 2000 `{return_kind: inflation, matures_from_year: 2031, matures_to_year: 2040}`; "Ações" 3000, member X.

- Assignment: LCI B meets "Reserva" and "Pós"; "Reserva" comes first, so it counts there. CDB A goes to "Pós", `NTNB.20350515` to "IPCA+". Stock X has no maturity and no liquidity fact, so no rule meets it; its member puts it in "Ações". Nothing is outside.
- Values 5,000.00, 10,000.00, 3,000.00, 2,000.00; total 20,000.00. Ratios `v/t`: 2.5, 3.333…, 1.5, 0.666….
- `C` = 2,000.00: "Ações" alone reaches the level (2,000.00 + 2,000.00) / 3000 = 1.333… < 1.5. Split: 0, 0, 0, 2,000.00.
- The same plan with the three fixed income groups as members-only groups that name no contract (today): values 0, 0, 0, 2,000.00; level (2,000.00) / 7000 per basis point funds the three empty groups only. Exact amounts 571.428…, 857.142…, 571.428…; the floors add up to 1,999.98, and CN9 gives the two remaining units to the two largest discarded fractions (0.857… of "Reserva" and "IPCA+"). Split 571.43, 857.14, 571.43, 0.
- Drift before (CN15): shares 2500, 5000, 1500, 1000 against 2000, 3000, 2000, 3000: (500 + 2000 + 500 + 2000) / 2 = 2500.

## API

All in `internal/portfolio/openapi.yaml`.

- `ContributionRule` (input and output): the conditions of GR2. `instrument_type` and each `subtypes` item have pattern `^[a-z0-9_]{2,40}$`. `quote_currency` is a string that `app` checks against the catalog (GR2). `return_kind` and `guarantee` are enums: FC9 and GR4 fix the sets, and regions do not extend them. Years are integers from 1900 to 2200.
- `ContributionClassInput.rules`: array, at most 5.
- `ContributionClass.rules` (always present, empty for a class by members) and `matched`: array of `{instrument, value}`, always present.
- `ContributionPlan.guarantee_name`: string, absent without a guarantee.
- `ContributionOutside.return_kind`: enum, absent without one.
- Problem `contribution_rule_invalid`, 422, detail "a group holds members or 1 to 5 rules, and each rule sets valid conditions".

## Screen

### Edit mode, assets panel of a group

The panel of a group (`editor/group-assets-panel.tsx`) opens with a segmented choice under its title: "Ativos escolhidos" | "Por regra". "Ativos escolhidos" is the panel as it is today. Turning to "Por regra" with members drops them after the confirmation "Os N ativos escolhidos saem do grupo." Turning back drops the rules, with the same confirmation in rule words.

With "Por regra":

- One muted line: "Entra no grupo todo ativo que atende uma das regras, inclusive os que você comprar depois."
- One row per rule, of fixed height: the rule in words (the summary below), cut with an ellipsis and whole in its title; at the end the count and value of the securities that meet it in the draft ("3 ativos · R$ 18.000,00", or "nenhum ativo hoje"); an edit icon button and a remove icon button, each with its tooltip.
- "Adicionar regra", disabled at five rules.
- Under the rows, the securities of the group in the draft, as the member rows of the panel without ideal controls: name, value, end-aligned.

The summary of a rule is one line: its conditions in the order of GR2, joined by " · ":

| Condition | Text (pt-BR) | Text (en) |
|---|---|---|
| `instrument_type` | the catalog label of the type (`instruments.type.<type>`) | same key |
| `subtypes` | the labels of `subtypeLabel`, joined by ", " | same |
| `quote_currency` | "em {code}" | "in {code}" |
| `return_kind` | `portfolio.fixedIncome.kind.<kind>` | same key |
| years | "vence de {from} a {to}", "vence a partir de {from}", "vence até {to}" | "matures {from} to {to}", "matures from {from}", "matures by {to}" |
| `daily_liquidity` | "liquidez diária" or "sem liquidez diária" | "daily liquidity" or "no daily liquidity" |
| `guarantee` | "coberto pelo {name}", "título público", "sem garantia" | "covered by {name}", "government bond", "no guarantee" |

With `guarantee` set and no `guarantee_name`, the summary ends with "garantia indisponível na região do livro" in the danger tone, and the count reads "nenhum ativo hoje".

### Rule dialog

"Adicionar regra" and the edit button open a dialog titled "Regra do grupo {name}". It is one column under `docs/contributing/forms.md`, each choice with its question:

1. "Tipo de investimento": select with "Qualquer" and the security types of the catalog.
2. "Subtipos": a checkbox group of the subtypes of the type (`subtypesQuery`), shown when a type with subtypes is chosen.
3. "Forma do retorno": segmented "Qualquer" | "Pós-fixado" | "Inflação" | "Prefixado", shown when the type is "Qualquer" or fixed income.
4. "Vencimento": two year fields, "De" and "Até", each optional.
5. "Liquidez diária": segmented "Qualquer" | "Sim" | "Não".
6. "Garantia": segmented "Qualquer" | "Coberto pelo {name}" | "Título público" | "Sem garantia", shown with a `guarantee_name`.
7. "Moeda de cotação": select with "Qualquer" and the currencies of the catalog.

Under the fields, the line "Entram hoje: {n} ativos · {value}" from the preview of the draft with this rule, or "Nenhum ativo atende hoje. Os que você comprar depois entram no grupo." "Salvar regra" is disabled while every choice is "Qualquer", with the field description "Escolha ao menos uma condição." The help popover of the editor (`editor/edit-help.tsx`) gains: "Um ativo escolhido em um grupo vale antes das regras. Entre regras, o ativo entra no primeiro grupo da lista."

### View mode

In the section "Carteira contra o ideal", the members of an expanded group by rule are its securities (`matched`), with their share inside the group ("do grupo") and no ideal marker. The purchase list writes a group by rule as a cash-like row ("aplicação por valor", CN section "Purchase list as one bar").

### Start from the portfolio

"Partir da minha carteira" follows GR9 from the outside entries and their `return_kind`.

## Cross-cutting questions

- R1: The facts of a government bond come from the code of the Brazilian `tesouro_direto` feed (`internal/marketdata/government_bonds.go`); the guarantee from `Jurisdiction.Guarantee` (FC22); the subtypes from `Jurisdiction.Subtypes`. No new regional value.
- R2: In a region without a jurisdiction: no subtypes to choose; `guarantee` is refused (GR2) and the dialog hides its field; return kind, maturity and liquidity come from terms only. Rules over type, currency, return kind, years and liquidity work in every region.
- R3: `instrument_type` and `subtypes` are patterns in SQL and OpenAPI. `return_kind` and `guarantee` are closed sets of this spec (FC9, GR4) that do not grow with regions.
- R4: Does not apply: no extension point.
- R5: Catalog keys under `contributionPlan.rule.*` in `catalog-contribution-plan.*` with pt-BR and en text: the segmented choice, the muted line, the summary parts of the table, the count, the dialog title, fields and choices, the "Entram hoje" lines, the confirmation of a mode change, the danger line, the help sentence, the problem text of `contribution_rule_invalid`.
- R6: Years through `numberFormatter` without grouping; amounts through `useMoneyFormat()`; counts through `numberFormatter`.
- C1: Values are `int64` minor units with currency (CN5); no new amount.
- C2: Matched securities are converted to the base currency one at a time by CN5; a missing price or rate gives `incomplete` with the instrument (GR6).
- C3: A security quoted in another currency is valued at today's rate in the base currency (CN5); `quote_currency` filters by the security's currency, not by the base.
- C4: Amounts on screen through `useMoneyFormat()`; currency from the response.
- T1: Facts and values at today from `platform/clock` in the book time zone (GR5).
- T2: Does not apply: no business day is counted; a maturity year compares calendar years.
- B1: `portfolio_contribution_rule` holds `books_id`; every query filters by it; a schema test inserts a row without a book and expects the rejection, and another inserts a row with no condition and expects the CHECK.
- B2: No new operation; the existing role tests of GET, PUT and preview stand (S405).
- B3: Does not apply: no setting.
- D1: `portfolio_contribution_rule` is a fact of the export; the archive version rises by one.
- D2: Migration `db/migrations/00130_portfolio_contribution_rule.sql`, or the next free number at the commit.
- D3: Does not apply: the plan changes no transaction.
- D4: Does not apply: no data from a bank, a file or a model.
- D5: Does not apply: the diagnostic file gains no field.
- S1: No new operation. `contribution_rule_invalid` has an HTTP test (S644). `TestToolCatalog` runs with `-update`, and the declaration of `save_contribution_plan` stays within 3,500 bytes (`internal/server/catalog_quality_test.go`).
- S2: Does not appear on a phone (CN, ADR 027).
- S3: `internal/assistant/guide/articles/investments.md`, section of the contribution plan, describes groups by rule, the order of GR5 and the guarantee words, in the commit of the screen.
- S4: The assistant reads and writes rules through `get_portfolio` view `contribution` and `save_contribution_plan` (GR11).
- X1: S639 a class by rule values the contracts it meets and the outside list excludes them (GR12). S640 an instrument member wins over a rule, and the first class wins among rules (GR12, LCI B). S641 `LFT.20290301` meets `{return_kind: rate, daily_liquidity: true}`; `NTNB.20350515` meets `{return_kind: inflation, matures_from_year: 2035}` and not `{daily_liquidity: true}`. S642 a matched security without a price gives `incomplete` with its instrument. S643 a book of region `DE` saving a rule with `guarantee` receives `contribution_rule_invalid`. S644 a class with members and rules, a rule with no condition, `subtypes` without `instrument_type`, `matures_from_year` after `matures_to_year`, and six rules each receive `contribution_rule_invalid`. S645 the preview of GR12 with 2,000.00 returns 0, 0, 0, 2,000.00. S646 a book with base `USD` values a BRL contract of a class by rule at today's rate. `guarantee: uncovered` meets a debenture and not `NTNB.20350515` or a CDB (domain test of GR4).
- X2: S643 runs in region `DE`; S646 runs with a base currency other than the contract's.

## Left to the builder

- The file split inside `internal/portfolio/app` (a `contribution_rules.go` beside `contribution_value.go`) and the folder of the rule editor under `web/src/features/portfolio/contribution-plan/` (`rules/`, since `editor/` holds 34 of its 40 files, O16).
- Whether the facts of GR3 reach `portfolio` through a new method of the `MarketData` port or through `InstrumentOf`.
