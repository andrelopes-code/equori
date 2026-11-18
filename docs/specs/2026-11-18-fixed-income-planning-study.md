# Fixed income in the contribution plan and in daily recording: study

- Date: 2026-11-18
- Status: study; each approach of section 4 becomes a spec that answers `docs/contributing/feature-design.md` before code
- Modules: `portfolio`, `ledger`, `marketdata`; web features `portfolio`, `transactions`
- Read from the code at commit `fa7c8cc6`

## 1. Question

A Brazilian investor buys bank and private fixed income (CDB, LCI, LCA, CRI, CRA, debentures) and public bonds (Tesouro) of many issuers, rates, indexes and maturities. The contract chosen on a contribution day is not known in advance: the broker's offer list changes during the day. The study asks whether the contribution plan and the recording flows serve that investor, and which approach closes each gap.

## 2. Findings in the code

| ID | Finding | Evidence |
|---|---|---|
| F1 | A plan member is one instrument code or one cash account. | `internal/portfolio/app/contribution.go:286-327`; CN3 |
| F2 | Each new contract gets a new code, so each purchase creates an instrument the plan does not name. | FC2 (`RF.<YYMMDD>.<5 characters>`) |
| F3 | A holding no member names is outside the plan: its value enters no group. A fixed income group whose contracts are not listed is undervalued, and CN7 sends it more money than its ideal asks. The screen shows no sign of the error beyond the outside-the-plan count. | CN6, CN7; `contributionPlan.outsideMany` |
| F4 | The fixed income application needs four fields: amount, issuer, maturity, rate. The contract is created with the purchase. | `web/src/features/transactions/fixed-income-entry/fixed-income-draft.ts:81-87`; FC11 |
| F5 | A sale requires a quantity. The order total derives the unit price from the quantity, never the quantity from an amount. | `web/src/features/transactions/trade-entry/trade-form.tsx:124`; `unit-price-of-total.ts` |
| F6 | The brokerage note takes existing instruments only; it creates no contract. | `web/src/features/transactions/note-entry/note-order-row.tsx:107`; `internal/ledger/app/notes.go` |
| F7 | The purchase list of the plan has no action that records a purchase; "Copiar lista" is the only output. | CN non-goal "Recording the purchases from this screen" |
| F8 | The entry route already prefills a trade from its query: side, date, quantity, unit price. | `web/src/features/transactions/trade-entry/trade-draft.ts:50-60` (FC20) |
| F9 | The return kind of a contract (rate, inflation, fixed) is computed on the client only, from the period of its index. | `web/src/features/portfolio/fixed-income/return-kind.ts:19-29`; FC9 |
| F10 | The issuer key of the exposure is the issuer id or the folded name. Two institutions of one conglomerate are two issuers. | `internal/portfolio/app/issuer_exposure.go:123`; FC3, FC23 |
| F11 | The plan holds at most 20 groups. | `internal/portfolio/domain/contribution.go:18` |
| F12 | The plan is desktop-only; the application form is a phone route. | CN non-goals; FC S2; ADR 027 |
| F13 | "Salvar e registrar outra" exists on the new entry page. | `web/src/features/transactions/pages/new-transaction-page.tsx:117` |
| F14 | `tesouro` is a subtype of `fixed_income` with a sovereign issuer; its price is the "PU Venda Manhã" of the feed. | `internal/portfolio/jurisdiction/br/br.go:29,60`; `internal/marketdata/tesouro_test.go:19` |

## 3. External facts

| Fact | Source |
|---|---|
| The FGC limit of R$ 250,000.00 applies per holder per conglomerate, not per institution; covered products held in one conglomerate are summed. | [FGC regulation](https://fgc.org.br/documents/d/asset-library-52554/regulamento-fgc); [FGC material for brokers, Dec. 2025](https://fgc.org.br/documents/d/guest/material-para-corretoras_versao-dezembro2025) |
| The central bank publishes the register of institutions and conglomerates of IF.data per reference month (`IfDataCadastro`, Olinda OData). | [IF.data, methodology](https://www.bcb.gov.br/conteudo/dadosabertos/BCBDesig/IFData%20-%20Esclarecimentos%20e%20Metodologia.pdf); [open data resource](https://dadosabertos.bcb.gov.br/dataset/ifdata---dados-selecionados-de-instituies-financeiras); [python-bcb IF.data](https://wilsonfreitas.github.io/python-bcb/ifdata.html) |
| A prudential conglomerate contains the financial conglomerate and further entities. | IF.data methodology, above |
| Tesouro Direto has no minimum amount since 2024-11-18; purchases are multiples of 0.01 bond. | [Seu Dinheiro, 2024](https://www.seudinheiro.com/2024/renda-fixa/tesouro-direto-ainda-mais-acessivel-b3-anuncia-fim-do-valor-minimo-de-aporte-e-programa-passa-a-permitir-investimentos-com-menos-de-r-30-lvit) |
| Broker research tables describe each fixed income asset by index, maturity, duration, rate, tax exemption and rating. | [XP Research, fixed income portfolio, Mar. 2025](https://acionista.com.br/wp-content/uploads/2025/03/CarteiraRendaFixaMar25-XPResearchRF_compressed.pdf) |
| Market commentary splits fixed income into post-fixed, inflation and pre-fixed; one example portfolio holds 95% post-fixed, 3% inflation, 2% pre-fixed. | [Monitor Mercantil](https://monitormercantil.com.br/posicionamento-na-renda-fixa-no-restante-de-2026-e-em-2027/) |
| A maturity ladder splits capital into rungs of dated maturities; the emergency reserve stays outside it. | [Meelion, ladder](https://www.meelion.com/blog/educacao-financeira/escada-de-vencimentos-renda-fixa-liquidez-no-prazo/); [Suno, ladder](https://www.suno.com.br/noticias/colunas/luiz-grubert/estrategia-ladder-lg/amp/) |
| Exempt and taxed securities are compared through the gross-up of the rate. | [XP, exempt fixed income](https://conteudos.xpi.com.br/renda-fixa/relatorios/renda-fixa-isenta-de-ir/) |

Not found: the published method of a Brazilian tracker (Kinvo, Investidor10, Gorila) for fixed income targets in a rebalance.

## 4. Approaches

Each approach names the finding it closes, the option chosen, and the option rejected.

### A1. Group member by rule (closes F1, F2, F3)

A member gains a third kind, `rule`, beside `account_id` and `instrument`. A rule is a conjunction of optional conditions over facts the contract already holds:

| Condition | Values | Source |
|---|---|---|
| Instrument type | `fixed_income`, `fund`, `etf`, … | `marketdata_instrument.type` |
| Subtype | region subtypes (`tesouro`, `cdb`, …) | `br.Subtypes` |
| Return kind | `rate`, `inflation`, `fixed` | index period (FC9) |
| Maturity year | from, to (both optional, inclusive) | `matures_on` |
| Daily liquidity | yes, no | `daily_liquidity` (FC4) |
| Guarantee | covered, not covered | `Guarantee.Covered` (FC22) |
| Tax class | exempt, taxed | `TaxClass` (FC24) |

Rules:

- A holding takes the first member that names it, in this order: an `instrument` member, then the `rule` members in plan order. One holding counts in one group, which keeps the uniqueness of CN3.
- A group with rule members cannot split its ideal among them (CN4 stays for instrument members). A group is either a list of assets or a set of rules.
- The return kind moves to `internal/portfolio/domain` and is served by the API. `return-kind.ts` reads the served field. The rule of FC9 then has one implementation.
- CN12 (start from the portfolio) creates for fixed income one group per return kind held, each with one rule member, in place of one member per contract.

Maturity by year, not by "years from today": a relative range moves a contract to another group as it ages. The group's value then changes without a purchase or a sale, and the drift of CN15 moves on its own. Dated rungs are the form of the ladder in the sources of section 3.

Rejected: a sub-ideal per characteristic inside a "Fixed income" group. It adds a third level to the editor and to CN8. With F11 (20 groups), a plan of reserve, post-fixed, two inflation rungs, pre-fixed and four equity groups uses 9.

A ceiling on private credit is a group with the rule "guarantee: not covered" and its ideal. CN7 never sells, so a group above its ideal receives nothing: the ideal works as the ceiling for new money. No ceiling concept is added.

### A2. Plan row to record (closes F7)

Each row of the purchase list opens the entry route with the fields filled:

- an `instrument` row: the trade form, side buy, instrument, quantity of CN17, through the query of F8;
- a `rule` row or a group without members: the fixed income application form with the amount. The return segment is set from the rule's return kind, and the maturity shortcut keeps the date inside the rule's years;
- an `account_id` row: a transfer to that account with the amount.

The route query gains `amount`, `instrument`, `return_kind`, `matures_from`, `matures_to`. No new operation.

### A3. Redemption and contribution by amount (closes F5)

A book-owned `fixed_income` holding takes a sale by amount: quantity = amount ÷ the chosen price at the date, half to even to scale 6. This is the rule FC13 already applies to an application. "Resgatar tudo" fills the whole quantity, so no unit remains after a total redemption.

`tesouro` keeps quantity and order total. The feed price is the morning sell price (F14), not the price of the purchase, so a quantity derived from it differs from the statement. The Tesouro statement states both quantity and amount, and the order total already takes both.

### A4. Offers and batch application (closes F6, the 10 o'clock case)

The fixed income application form takes several rows that share the brokerage and the date. Each row holds the four fields of F4 plus kind and liquidity. Under each row, one line states:

- the plan group the contract would join (A1 applied to the draft);
- the rate of the other tax class that yields the same, from the calculator's rule (`calc.fixedIncome.equivalentTaxable`);
- the FGC headroom left with the issuer (A5).

Saving posts one application per marked row, each with its own `application_id`. A failure keeps its row and its error; a retry of the same row is idempotent (FC14). The rows typed to compare are the rows recorded, so a contract is typed once.

Rejected: extending the brokerage note to create contracts. A note serves the trades of one exchange session with one fee apportionment (`note-entry/apportion.ts`). Bank products bought on a shelf carry no note, and the fees differ per product.

F13 stays the path for one contract after another without comparison.

### A5. Exposure by conglomerate (closes F10)

The region `br` maps an issuer id to a conglomerate code from the IF.data register (`IfDataCadastro`), refreshed by a marketdata feed. The issuer key of FC23 becomes the conglomerate code when the map knows the issuer, otherwise the issuer id, otherwise the folded name. A neutral region has no map.

The register lists prudential conglomerates, which contain the financial conglomerate the FGC counts. Grouping by the prudential conglomerate can join two issuers the FGC separates, never separate two it joins: the computed excess can be higher than the FGC's, never lower. A region row "Issuer conglomerate" goes to `docs/contributing/regions.md`.

Open before the spec: the field list of `IfDataCadastro` and whether it carries each member's CNPJ. Section 3 did not confirm it.

### A6. Assistant from a document

The application confirmation of a broker or bank lists several contracts. With files in a conversation (ADR 020, work in progress in the tree), the assistant reads the document and proposes one `record_fixed_income` per contract in one sheet, under "One decision per answer" of `docs/contributing/web.md`. This adds no operation: the `fixed_income` article names the path.

### A7. Plan on the phone (closes F12)

The section "Este mês" (amount, verdict, purchase list with A2's actions) becomes a phone route, read-only. The editor stays desktop-only. The amendment to ADR 027 (S3) lists the route.

## 5. Personas after the approaches

| Persona | Scenario | Flow |
|---|---|---|
| First-time, monthly R$ 500, Tesouro Selic and a daily-liquidity CDB | Partial redemption | A3: amount, date, save |
| Monthly diversified, R$ 3,000, ETFs and CDBs | Monthly contribution | Plan states "R$ 1.200,00 em IPCA+ 2031–2035"; the row opens the application (A2); the contract joins its group (A1) |
| Rate hunter, four contracts at 10:00 | Choice and record | A4: four rows, each with its group, equivalent rate and headroom; one save |
| Reserve saver, weekly deposits | Deposit and redemption | "Aplicar mais" by amount; A3 for the redemption; group "Reserva" by rule "daily liquidity: yes" |
| Advanced, inflation ladder and incentivised debentures | Ladder per year | One group per rung by maturity years (A1); payments and events unchanged (FC17 to FC20) |
| Open Finance user | Synced applications | FC28 proposals; confirmed contracts join their groups (A1) |
| Any | Many contracts on one confirmation | A6 |

## 6. Order

| Step | Approach | Depends on | Reason for its place |
|---|---|---|---|
| 1 | A1 | none | F3 is a wrong amount, the only defect of correctness |
| 2 | A2 | A1 | Uses the rule to prefill; reuses F8 |
| 3 | A3 | none | Unblocks the reserve and redemption scenarios |
| 4 | A4 | A1, A5 for the headroom line | Largest screen change |
| 5 | A5 | none | Needs the open item of A5 settled |
| 6 | A7 | A2 | Needs an amendment of ADR 027 |
| 7 | A6 | files in a conversation | Waits for that work |
