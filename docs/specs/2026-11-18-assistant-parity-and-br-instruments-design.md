# Assistant parity, complete guides and Brazilian instrument coverage

Status: draft, awaiting the owner's answers to section 8.
Date: 2026-11-18.
Amends on delivery: ADR 012 (T14, exclusion reasons), `docs/specs/2026-11-17-assistant-grounding-design.md` (article ceiling).

## 1. Goal

Three outcomes, each with a test that fails when it regresses:

1. The assistant performs every action a member performs on a screen, except the actions of section 4.3.
2. A guide article holds every fact the assistant needs to instruct and to act. No fact is removed to fit a size limit.
3. A matrix of Brazilian investment products, each row tied to a primary source, runs through the HTTP API and through the tools, and the assistant holds the facts of each row.

Terms. A tool is an operation a language model calls (ADR 012). An exclusion is an entry of `internal/server/tool_exposure_test.go` that starts with `-`. A product is one row of the matrix of section 5: an instrument type, a subtype and a set of terms.

## 2. State on 2026-11-18

Read from the code at commit `0d22c488`.

| Fact | Value |
|---|---|
| Guide articles | 26, 56,478 bytes in total |
| Article size limit | 200 to 6,000 characters (`guide_test.go`, `TestArticlesExist`) |
| Largest articles | `income_split` 5,246; `investments` 5,119 |
| Existing guide checks | quoted labels exist in the catalog; bold terms exist in the glossary; each topic has a screen |
| Missing guide check | no test ties an article to the tools or to the input fields of its topic |
| Excluded operations | 104 entries in 13 classes |
| Instrument types | `currency`, `stock`, `reit`, `etf`, `depositary_receipt`, `fixed_income`, `fund`, `crypto` |
| BR fixed income subtypes | `cdb`, `rdb`, `lc`, `lf`, `debenture`, `lig`, `tesouro`, `lci`, `lca`, `lh`, `lcd`, `cdca`, `cri`, `cra`, `debenture_incentivada` |
| BR fund subtypes | `fixed_income_fund`, `multimarket`, `equity_fund` |
| Rate forms | percent of an index; index plus spread; pre-fixed |
| Day counts | `bus252`, `act365` |
| Corporate actions | `split`, `reverse_split`, `bonus`, `unit_tax` |

Defects confirmed:

- D-1. `investment_operations.md` describes the brokerage note, the corporate action and the custody transfer only as screen steps. `recordBrokerageNote`, `recordCorporateAction` and `recordCustodyTransfer` are excluded as `-screen`: the assistant cannot do what the article describes.
- D-2. `saveContributionPlan` is excluded as `-visual`; it is a write.
- D-3. `confirmInvestmentMovement`, `dismissInvestmentMovement` and `undoInvestmentMovement` are excluded as `-screen`: the assistant cannot review an investment movement read from a bank connection.
- D-4. `updateSettings` (`-setup`) and `setMemberAppearance` (`-visual`) are excluded: the assistant cannot change language, region or appearance.
- D-5. `fixed_income.md` states "index_id of a monthly index and spread". A debenture, a CRI and a CRA commonly pay CDI plus a spread. Section 5 row F-04 verifies whether a daily index accepts a spread; the article states the verified answer.
- D-6. `investments_br.md` holds fixed income, Tesouro Direto, dividends, JCP, funds and FII in 3,330 bytes. It holds no rule for the sale of a stock, an ETF, a BDR or a FII unit, and no row for a product outside the subtype list.

## 3. Guides

| ID | Rule |
|---|---|
| G1 | An article is complete when it names, for each tool of its topic: the tool, each required input, each input with a closed value set and its values, the fact the user supplies for each input, and each `Problem.code` the tool returns with its cause. |
| G2 | The article limit of 6,000 characters is replaced by 16,000. An article above the limit is split by sub-topic into two topics; a fact is never removed to meet the limit. The limit of 200 stays. |
| G3 | `TestGuideCoversTools` fails when a tool of `internal/server/testdata/tools.json` is named in no article, or when a required input or an enumerated value of a tool with effect `Write` or `Destructive` appears in no article that names the tool. |
| G4 | `TestGuideCoversSubtypes` fails when a subtype returned by a jurisdiction for an instrument type is absent from the article of that region. |
| G5 | `TestGuideCoversLimits` fails when an exclusion class of section 4.3 is absent from `privacy_and_the_assistant.md`. The article names each action the assistant does not perform and the screen that performs it. |
| G6 | An article describes a screen step and the tool that does the same in one paragraph. A screen step without a tool is allowed only for an action of section 4.3. |
| G7 | The size ceiling of `TestToolCatalog` follows the same rule as G2: a description is not shortened below the content G1 requires. The ceiling is raised to the measured size of the complete catalog plus 10%. |
| G8 | `get_help_topic` returns the whole article. No summary, truncation or selection of paragraphs sits between the article and the model. |

Regional articles after the split of `investments_br`:

| Topic | Content |
|---|---|
| `investments_br` | index of the four articles below, the tax year, the identifier schemes |
| `fixed_income_br` | one table row per bank and private product of section 5.1 |
| `government_bonds_br` | one table row per Tesouro Direto security of section 5.2 |
| `equities_br` | stocks, units, FII, Fiagro, ETF, BDR, their income and their sale (section 5.3) |
| `funds_br` | open funds, come-cotas, exempt funds, pension plans (section 5.4) |

Each product row of an article holds: the name in pt-BR and its code, type and subtype, the tool that records it, the facts to ask the user, the rate forms it accepts, the tax of an individual, the guarantee, the liquidity rule, and the source with its article and the date read.

## 4. Tool parity

### 4.1 Rule

| ID | Rule |
|---|---|
| P1 | The web interface reaches the server only through `api/openapi.yaml`. Parity is therefore measured per `operationId`: an operation without an exclusion of 4.3 has a tool. |
| P2 | The exclusion classes `-screen`, `-visual`, `-dialog` and `-setup` are removed. `TestToolExposure` rejects them. |
| P3 | A write tool keeps the confirmation of ADR 020: the assistant proposes, the member confirms. |
| P4 | A tool takes the same input the operation takes. No field of the operation is dropped from the tool input. |
| P5 | An operation that takes a file (`-file`) is covered when the chat accepts an attachment (phase 4). Until then the class stays and G5 lists it. |
| P6 | Each new tool has a test through `apitest.Tool`, and each error code it returns has one (ADR 012 T14). |

### 4.2 Operations that gain a tool

| Operation | Class today | Tool |
|---|---|---|
| `recordBrokerageNote` | `-screen` | `record_investment`, kind `brokerage_note` |
| `recordCorporateAction` | `-screen` | `record_investment`, kind `corporate_action` |
| `recordCustodyTransfer` | `-screen` | `record_investment`, kind `custody_transfer` |
| `getAccountLots` | `-screen` | `get_portfolio`, view `lots` |
| `listConnectionInvestments` | `-screen` | `get_imports` |
| `confirmInvestmentMovement`, `dismissInvestmentMovement`, `undoInvestmentMovement` | `-screen` | `manage_imports` |
| `deleteBudgetBucketVersion` | `-screen` | `manage_budget_or_goal` |
| `setAccountCardFace` | `-screen` | `manage_card` |
| `saveContributionPlan` | `-visual` | `manage_contribution_plan` (new) |
| `getBudgetBucketEntries` | `-visual` | `get_budgets_and_goals` |
| `listCategoryCashPayments` | `-visual` | `get_budgets_and_goals` |
| `getStatementAnalytics`, `getCardStatementAnalytics` | `-visual` | `get_account_details` |
| `getNetWorthDays` | `-visual` | `get_portfolio`, view `net_worth_days` |
| `getTag` | `-visual` | `get_transaction` |
| `getInstitutionIndicators`, `listInstitutionIdentifierSchemes` | `-visual` | `get_market_data` |
| `getMemberAppearance`, `setMemberAppearance` | `-visual` | `manage_settings` (new) |
| `updateSettings` | `-setup` | `manage_settings` (new) |
| `probeQuote` | `-dialog` | `get_market_data` |
| `recordInstrumentPrices` | `-file` | `manage_instrument` (JSON body, no file) |
| `requestExport`, `getExport` | `-file` | `manage_book`; the answer is the download link |
| `getCsvProfile`, `saveCsvProfile` | `-file` | `manage_imports` |

A tool that would exceed the layout limits of CONTRIBUTING is split by kind in the plan; the table fixes the coverage, not the tool count.

### 4.3 Exclusions that remain

| Class | Operations | Reason |
|---|---|---|
| `-session` | sign-in, second factor, passkeys, books of the session | The action changes who is signed in or which book the session reads. |
| `-secret`, `-credential` | access tokens, connection credentials, invitation tokens, copy password | The value would enter a stored conversation. |
| `-llm` | providers, chains, limits, conversations | The assistant does not change its own model, keys or limits. |
| `-erase` | `deleteCurrentBooks` | Erases the book. |
| `-binary` | `getAttachmentContent` | The answer is a binary body. |
| `-capture` | capture preview and suggestions | The operation is itself a model call that the assistant replaces. |
| `-instance` | backup, diagnostic, feeds, schedules, version | Owner decision Q2. |
| `-file` | imports, attachments, CSV column suggestion | Until phase 4 (P5). |

## 5. Brazilian product matrix

### 5.1 Rules

| ID | Rule |
|---|---|
| M1 | The matrix is a Go table in `internal/apitest` consumed by `TestBRProductMatrix`. One row is one product. |
| M2 | A row holds: ID, pt-BR name, type, subtype, terms, the source (norm, article, URL, date read) and a worked example: application, index series, dates, expected gross value, expected tax, expected net value. |
| M3 | The expected values of a row come from a published calculation: the methodology of Tesouro Direto, the formula book of B3 for the security, the ANBIMA methodology, or an example of the norm. A value computed only by equori is not an expected value. |
| M4 | Each row runs twice: through the HTTP operations and through the tools (`apitest.Tool`). Both paths produce the same position, price, tax and income. |
| M5 | Steps of a row: define or record the product, apply money, add a second application, accrue to the example date, record each income event, redeem part, redeem the rest, read the position, the tax estimate and the issuer exposure. |
| M6 | A source is a primary source: a law or decree (planalto.gov.br), a CMN or BCB resolution (bcb.gov.br), a CVM resolution (gov.br/cvm), an RFB instruction (normas.receita.fazenda.gov.br), the FGC regulation (fgc.org.br), a B3 or ANBIMA methodology, the Tesouro Direto site. A broker page, a blog and a model's memory are not sources. |
| M7 | A product the system does not support is not a row of the test. It is a row of `docs/domain/br-product-coverage.md` with the verdict `unsupported` or `partial`, the missing capability and its issue number. The row moves to the test in the commit that implements it. |
| M8 | The article row of a product (section 3) and the matrix row cite the same source. `TestGuideCoversSubtypes` and a test of the matrix IDs keep both lists equal. |

### 5.2 Candidate rows

The lists below are the scope to verify. Column "Check" names what the audit of phase 1 must establish; no verdict is given before the row runs. Sources are named by the audit after reading them; none was read in this session beyond those cited in `internal/portfolio/jurisdiction/br/br.go` and `internal/ledger/region_defaults.go`.

Bank and private fixed income (`fixed_income`):

| ID | Product | Variant | Check |
|---|---|---|---|
| F-01 | CDB | percent of CDI, daily liquidity | supported today; baseline row |
| F-02 | CDB | pre-fixed, bus252 | worked example against a published formula |
| F-03 | CDB | IPCA plus spread | pro rata rule of the monthly index against the issuer practice |
| F-04 | CDB, debenture, CRI, CRA | CDI plus spread | whether a daily index accepts a spread (D-5) |
| F-05 | CDB | progressive rate by holding period | no rate form exists |
| F-06 | RDB | percent of CDI, not transferable | subtype exists |
| F-07 | LCI, LCA | percent of CDI, minimum term before redemption | minimum term by CMN rule in `redeemable_from` |
| F-08 | LCI, LCA | IPCA plus spread, pre-fixed | minimum term differs by indexer |
| F-09 | LC | pre-fixed, percent of CDI | subtype exists |
| F-10 | LF | senior and subordinated, minimum ticket, no redemption before maturity | no FGC; subordinated variant has no subtype |
| F-11 | LIG | exempt interest | `br.go` classes it as taxed and the article states "not confirmed" |
| F-12 | LH, LCD | exempt, FGC | subtype exists |
| F-13 | DPGE | special FGC limit | no subtype; guarantee model holds one limit |
| F-14 | Debenture | common, half-yearly coupon, amortization | coupon schedule and amortization table |
| F-15 | Debenture | incentivized (Lei 12.431/2011), IPCA plus spread | exempt; tax rule of 2026 onward to verify |
| F-16 | CRI, CRA | IPCA plus spread, monthly interest, irregular amortization | unit price formula of B3; monthly interest period |
| F-17 | CRI, CRA | percent of CDI, CDI plus spread, pre-fixed | each rate form |
| F-18 | CDCA, CPR, commercial note, LAM | each | CPR, commercial note and LAM have no subtype |
| F-19 | Any taxed security | redemption inside 30 days | IOF table, covered by `brFixedIncomeWithholding` |
| F-20 | Any security | sale before maturity on the secondary market | price differs from the accrued price; result and tax |
| F-21 | Index | IGP-M, Selic, exchange rate | only `cdi` and `ipca` are named in the article |
| F-22 | Savings (poupança) | account of kind `savings` | yield rule and exemption; an account, not an instrument |

Government bonds (`fixed_income`, subtype `tesouro`):

| ID | Product | Code | Check |
|---|---|---|---|
| T-01 | Tesouro Selic | LFT | price from the source; buy, sale, FIFO cost |
| T-02 | Tesouro Prefixado | LTN | same |
| T-03 | Tesouro Prefixado with half-yearly interest | NTNF | coupon event and its tax |
| T-04 | Tesouro IPCA+ | NTNBP | same as T-01 |
| T-05 | Tesouro IPCA+ with half-yearly interest | NTNB | coupon event and its tax |
| T-06 | Tesouro RendA+ | RENDA | monthly income phase after the conversion date |
| T-07 | Tesouro Educa+ | EDUCA | monthly income phase |
| T-08 | Tesouro IGPM+ | NTNC | no new sale; holdings exist |
| T-09 | Custody fee of B3 | all | fee event, its exemption band for Tesouro Selic |

Listed securities:

| ID | Product | Type | Check |
|---|---|---|---|
| E-01 | Stock ON, PN, unit; round lot and fractional market | `stock` | one instrument or two for the fractional code |
| E-02 | Sale of stock | `stock` | monthly exemption of sales, rate, loss carried forward |
| E-03 | Day trade | `stock` | `SeparatesDayTrades` exists; rate and withholding |
| E-04 | Dividend, JCP | `stock` | covered by the article; Lei 15.270/2025 withholding example |
| E-05 | Bonus, split, reverse split, fraction auction | `stock` | corporate action kinds exist |
| E-06 | Subscription right and receipt, exercise and sale | `stock` | no corporate action kind |
| E-07 | Merger, spin-off, ticker change | `stock` | no corporate action kind |
| E-08 | FII, Fiagro: distribution, amortization, sale | `reit` | amortization lowers cost; sale has no exemption |
| E-09 | ETF of stocks, ETF of foreign index | `etf` | sale has no exemption |
| E-10 | ETF of fixed income | `etf` | tax by the term of the portfolio, withheld at source |
| E-11 | BDR: dividend with foreign tax, sale | `depositary_receipt` | tax class `bdr` exists |
| E-12 | Option, forward, future, securities lending | none | no instrument type |
| E-13 | Brokerage note with several orders, costs and withheld tax | all | operation exists; tool missing (D-1) |

Funds and others:

| ID | Product | Type | Check |
|---|---|---|---|
| U-01 | Fixed income fund, multimarket: long and short term, come-cotas | `fund` | `unit_tax` exists; long and short term have one subtype pair |
| U-02 | Equity fund | `fund` | 15% at redemption, no come-cotas |
| U-03 | Exempt funds: FI-Infra, incentivized debenture fund | `fund` | no subtype |
| U-04 | FIDC, FIP, closed funds | `fund` | no subtype |
| U-05 | Pension plan PGBL, VGBL; progressive and regressive table | none | no instrument type |
| U-06 | COE | none | no instrument type |
| U-07 | Crypto asset: sale, monthly exemption | `crypto` | no BR tax class |
| U-08 | Foreign stock and ETF held abroad | `stock`, `etf` | Lei 14.754/2023 annual rate; conversion date of the rate |

## 6. Assistant behavior

| ID | Rule |
|---|---|
| A1 | Before a write of an investment the assistant reads the article of the region for the product (`get_help_topic`) in the same turn. The system prompt states this rule; a test of the prompt text guards it. |
| A2 | The assistant asks for each missing fact the article row lists and names no default the article does not state. |
| A3 | A product with the verdict `unsupported` in the coverage document has a line in the article: what is not recorded and the closest correct record, or none. The assistant states it and does not record the product as another subtype. |
| A4 | An eval set (build tag `eval`, run only by the owner) holds one conversation per matrix row: the user describes the product in plain pt-BR, the expected result is the tool call with the row's inputs. |

## 7. Delivery order

| Phase | Content | Done when |
|---|---|---|
| 1 | Audit: read the sources of section 5, write `docs/domain/br-product-coverage.md` with a verdict per row, open one issue per `unsupported` or `partial` row | every row has a source, a verdict and an issue or a test name |
| 2 | Parity: tools of 4.2, removal of the four classes, G5 article | `TestToolExposure` and `TestToolCatalog` pass without `-screen`, `-visual`, `-dialog`, `-setup` |
| 3 | Guides: G1 to G4, G6 to G8, split of the regional article | the four guide tests pass |
| 4 | Matrix test for the rows with the verdict `supported` | `TestBRProductMatrix` passes on both paths |
| 5 | One vertical slice per issue of phase 1, in the order of Q4; each moves its row into the test | the issue's row passes |
| 6 | Chat attachments and the `-file` operations | owner decision Q3 |

## 8. Open decisions (owner)

| ID | Question | Recommendation |
|---|---|---|
| Q1 | Article limit: 16,000 characters with a split above it (G2), or no limit | 16,000 with a split |
| Q2 | Instance operations (`-instance`): tool for an instance administrator, read only, or excluded | read tools for the administrator; writes stay on the screen |
| Q3 | Files in the chat (imports, attachments): in this spec as phase 6, or a spec of its own | a spec of its own |
| Q4 | Order of the unsupported products of phase 5 | F-04, F-16, F-14, E-06, U-05, E-12, then the rest by issue |
| Q5 | Eval run of A4: model and request budget | named by the owner at the time of the run |

## 9. Cross-cutting questions

- R1: The product matrix, the regional articles and the subtype lists vary by country. Extension points: `internal/portfolio/jurisdiction/<region>`, `internal/ledger/region_defaults.go`, one guide topic per region.
- R2: A region without a jurisdiction returns no subtype; G4 and the matrix test hold no row for it; the assistant reads `investments` and `fixed_income` only.
- R3: Subtypes and corporate action kinds added in phase 5 follow `^[a-z0-9_]{2,40}$`. The existing `enum` of `CorporateActionKind` and `day_count` is reviewed in the slice that adds a value.
- R4: A matrix per region is a new extension point; `docs/contributing/regions.md` gains the row in phase 4.
- R5: Guide articles are English (read by the model). A tool adds no screen text. A slice of phase 5 that adds a screen field adds its catalog keys in pt-BR and en.
- R6: Does not apply: phases 1 to 4 add no screen. A slice of phase 5 answers it in its plan.
- C1: Expected values of the matrix are integers of minor units in BRL.
- C2: Does not apply: each row holds one currency, except U-08, whose slice names the rate date and source.
- C3: The matrix runs with base currency BRL; X2 names the other case.
- C4: Does not apply: no screen amount is added in phases 1 to 4.
- T1: Each row fixes its dates through `apitest.Today`.
- T2: Rows with `bus252` use the calendar `br_banking` of the registry.
- B1: Does not apply: phases 1 to 4 add no table.
- B2: A new tool declares the role of the operation it wraps; `manage_settings` and `manage_contribution_plan` follow `updateSettings` and `saveContributionPlan`. No new operation is added in phases 1 to 4.
- B3: Does not apply: no setting is added.
- D1: Does not apply: no table is added in phases 1 to 4.
- D2: Does not apply in phases 1 to 4; a slice of phase 5 that adds a subtype constraint adds a migration.
- D3: A write through a new tool goes through the same service as the screen and keeps the transaction version.
- D4: A tool write is a model write: it waits for the member's confirmation (P3).
- D5: Does not apply: the diagnostic file gains no field.
- X1: One scenario per matrix row with the verdict `supported`, added to `docs/domain/06-scenarios.md` in phase 4; one scenario per tool of 4.2 in phase 2.
- X2: Each tool of 4.2 has a test in a book of a region without a jurisdiction. `record_investment` kind `brokerage_note` has a test with a brokerage in a currency other than the base currency.
