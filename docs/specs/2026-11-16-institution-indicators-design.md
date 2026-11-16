# Institution indicators (A237)

Amends: ADR 025 (a fourth kind of feed), `docs/contributing/regions.md` (one extension point).

## Goal

An account of an institution with a `br_ispb` identifier shows, on its screen, the prudential indicators the Banco Central do Brasil publishes for that institution: Basel index, principal capital ratio, fixed-asset ratio (imobilização), equity and net income, with the data-base date and the source. The figures come from the instance's own store, filled by a feed an admin enabled (ADR 025, N17). The browser never contacts the Banco Central.

## Facts checked against the source (2026-11-16)

Service: `https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata`, public, no key.

| Fact | Evidence |
|---|---|
| Latest period with data is 202606; 202609 and 202612 return no row | `IfDataValores(AnoMes=…, TipoInstituicao=1, Relatorio='5')?$top=1` |
| `IfDataCadastro(AnoMes)` lists 5,798 institutions with `CodInst`, `CodConglomeradoPrudencial`, `CnpjInstituicaoLider`, `NomeInstituicao`, `Situacao` | Nu Pagamentos `18236120` → `C0084693`; Inter `00416968` → `C0080996`; Itaú Unibanco `60701190` → `C0080099`; Mercado Pago IP `10573521` → `C0084820` |
| Figures are published per prudential conglomerate (`TipoInstituicao=1`), not per legal entity | `C0084693` returns rows; `TipoInstituicao=2` returns none for it |
| Resumo (`Relatorio='1'`) holds `Conta` 140246 equity, 141870 net income, 79662 fixed-asset ratio, 79664 Basel index; Informações de Capital (`'5'`) holds 79659 principal capital ratio | Same `Conta` and names in 202506, 202512 and 202606 |
| Ratios are decimal fractions; money is in reais with two decimals | Nu 202606: Basel 0.155091, principal capital 0.117600, fixed-asset 0.051018, equity 23344610717.36, net income 4093040225.39 |
| A value is often null | Of 1,398 institutions in 202606: Basel null for 73, fixed-asset null for 202, equity and net income null for 56 |
| Net income is not a year-to-date total | Nu: 202506 5.97 bn, 202509 2.89 bn, 202512 6.73 bn, 202603 1.42 bn, 202606 4.09 bn |

The period the net income covers is not stated in the sources read. The screen labels it "Net income in the period", and never "of the quarter" or "of the year".

## Decisions

| ID | Decision | Reason |
|---|---|---|
| I1 | Source `br_ifdata` is an institution source: interface `Source` in `internal/marketdata/institution/institution.go`, implementation in `internal/marketdata/institution/brifdata/`, entry in `institutionEntries` in `internal/marketdata/institutions.go`. | Same extension point shape as ADR 026 E1. |
| I2 | It is a feed of ADR 025 with `kind` `institution`: enabled on the settings screen, suggested by `SuggestedFeeds("BR")`, ticked, marked stale. | N17: the application contacts only feeds an admin enabled. |
| I3 | A tick finds the latest period by probing quarter ends from the current quarter back eight quarters with `IfDataValores(…,'1')?$top=1`, then reads the cadastro of that period, the four `Conta` of Resumo and `Conta` 79659 of Informações de Capital, all with `TipoInstituicao=1`. A period with no row is skipped. No period in eight quarters is `feed.ErrNoData`. | The latest period is not announced by the service. |
| I4 | A value is matched by `Conta` in the request and by name prefix in the response (`Patrimônio Líquido`, `Lucro Líquido`, `Índice de Basileia`, `Índice de Imobilização`, `Índice de Capital Principal`). A row whose name differs is ignored and its value is stored null. | A renumbered `Conta` yields "not informed", never another figure. |
| I5 | Table `marketdata_institution_indicator`, one row per `(scheme, identifier)`. An eight-digit `CodInst` of the cadastro gets the figures of its `CodConglomeradoPrudencial` when it has one, and its own figures otherwise; an institution with neither has no row. `conglomerate_code` and `conglomerate_name` say whose figures they are. A tick replaces every row of the source in one transaction. | The same replace-all as ADR 026 E3. |
| I6 | An institution reaches the figures of its conglomerate; the screen states "Prudential conglomerate: <name>". | An account at Itaú Unibanco S.A. is covered by `ITAU - PRUDENCIAL`; the figure is not the legal entity's. |
| I7 | A null value is stored null and written "Not informed". It is never read as zero. | "Do not lie to the user". |
| I8 | `last` of the feed is the last day of the stored period. It is stale when enabled, has a `last`, and today is after the last day of the next quarter plus 120 days. | On 2026-11-16, 47 days after 2026-09-30, 202609 is absent while 202606 is present; 120 days is a bound taken from that observation and revisited when a publication date is known. |
| I9 | `GET /market-data/institution-indicators?scheme=<scheme>&identifier=<id>` (`getInstitutionIndicators`), role `read`; 404 `not_found` when the feed is disabled or the institution has no row. | The web already holds the identifier of the institution. |
| I10 | The account screen gets a tab `institution`, drawn only for an account whose institution has an identifier and whose indicators answered 200. | A tab with nothing to show is not drawn. |
| I11 | A link "Open in IF.data" is drawn beside the data-base date; its address is one constant of the source. | The primary source, for verification. |

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Source `br_ifdata`; identifier scheme `br_ispb` (`internal/ledger/domain/identifier.go`). Extension point: row "Institution indicator source" in `docs/contributing/regions.md`; default in `SuggestedFeeds`. |
| R2 | A region without a source suggests no feed. The endpoint answers 404 `not_found`; no tab is drawn. |
| R3 | `scheme` and `source` are `^[a-z0-9_]{2,40}$` in SQL and `pattern` in `api/openapi.yaml`. `kind` of a feed gains `institution` in the existing enum, which is closed by design (ADR 025). |
| R4 | One new row in `docs/contributing/regions.md`, in the same change. |
| R5 | Catalog keys with pt-BR and en text for the tab name, each indicator, "Not informed", the conglomerate line, the data-base line, the link and the feed name. |
| R6 | Ratios through `Intl` percent, the data-base through `Intl` month and year, both from the active tag. |
| C1 | Equity and net income are integers of minor units with `currency` `BRL`; ratios are `numeric(12, 10)` fractions, not money. |
| C2 | No sum and no comparison across currencies. |
| C3 | The figures are in BRL whatever the base currency of the book. They are never converted; the currency symbol is drawn with the amount. |
| C4 | The currency comes from the response field `currency`. The amounts go through `useMoneyFormat()`. |
| T1 | The data-base is a calendar date without a zone. "Today" for staleness comes from `platform/clock`. |
| T2 | Does not apply: no business day is counted. |
| B1 | Does not apply: the table holds public data shared by the instance, as `marketdata_price` (ADR 025). A schema test rejects a row outside the patterns. |
| B2 | `read`. An HTTP test covers a member and an access without membership. The feed switch keeps `admin` (ADR 025 F8). |
| B3 | The setting is the feed's enabled flag in `marketdata_feed`, at instance level. |
| D1 | `marketdata_institution_indicator` is left out of the export, as `marketdata_index_expectation` (`TestEveryTableIsClassified`). The archive version does not change. |
| D2 | Migration `00105_marketdata_institution_indicator.sql`. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | The feed writes public data from the Banco Central. No user data is involved and a repeated tick leaves the same rows. |
| D5 | Does not apply: no field joins the diagnostic file. |
| S1 | One operation, `getInstitutionIndicators`, excluded from the tools as `-visual` in `internal/server/tool_exposure_test.go`. |
| S2 | The tab follows the account page's phone layout: one column of rows with the value end-aligned. A test runs at the phone width of the existing account page tests. |
| S3 | Guide article `internal/assistant/guide/articles/` of the accounts topic gains the tab. |
| S4 | The assistant does not read the figures in this change. A tool view is a later change. |
| X1 | Scenarios S471 to S477 in `docs/domain/06-scenarios.md`, each with a test through `internal/apitest`. |
| X2 | A book of region `US` suggests no `br_ifdata`; an unknown scheme is 404; a book of base currency `USD` shows BRL figures. |

## Scenarios

- S471: with `br_ifdata` enabled and the stored period 2026-06-30, `getInstitutionIndicators` for `br_ispb` `18236120` returns the conglomerate `NU PAGAMENTOS - PRUDENCIAL`, `basel` "0.1550912564", `principal_capital` "0.1175995987", `fixed_asset` "0.0510180761", equity 2334461071736, net income 409304022539, currency `BRL`.
- S472: a null Basel index in the source is `null` in the response, not `"0"`.
- S473: with the feed disabled the operation is 404 `not_found`.
- S474: an `br_ispb` without a row is 404 `not_found`; a scheme `bic` is 404 `not_found`.
- S475: a member of another book reads the same figures; a request without a session is 401.
- S477: a book of region `US` has `br_ifdata` listed with `suggested` false.
- S476: `GET /market-data/feeds` lists `br_ifdata` with `kind` `institution`, `last` 2026-06-30, and `stale` true when today is after 2027-01-28.

## Not covered

- The assistant tool (S4).
- Regulatory minimums beside the ratios: the sources read disagree (10.5% and 11%).
- Credit-union systems and any institution absent from `TipoInstituicao=1`.
- A history of periods.
