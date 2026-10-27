# Adding a region

A region is an ISO 3166-1 alpha-2 code stored on the user profile (`internal/platform/locale/regions.go`). A language is an ISO 639 code stored beside it. Behavior that depends on the region or the language is an extension point (ADR 016): an interface declared by the consuming module, one implementation per identifier, and a default function that maps a region to an identifier.

Identifiers match `^[a-z0-9_]{2,40}$`. A regional identifier is prefixed by the lowercase region (`br_banking`, `br_ispb`); an international one is not (`ecb`, `weekend`, `bic`).

## Extension points

Paths are relative to the repository root. `<module>` stands for the module directory under `internal/`.

| Extension point | Interface file | Implementation directory | Registry constructor | Region default file | Test file |
|---|---|---|---|---|---|
| Calendar | `internal/marketdata/internal/calendar/calendar.go` (`Calendar`) | `internal/marketdata/internal/calendar/` (`br_banking.go`, `weekend.go`; rule tables in `rule.go`) | `marketdata.New` in `internal/marketdata/marketdata.go` | `internal/marketdata/region_defaults.go` (`DefaultCalendar`) | `internal/marketdata/calendar_test.go`, `internal/marketdata/internal/calendar/rule_test.go` |
| Price source | `internal/marketdata/internal/feed/feed.go` (`Source`) | `internal/marketdata/internal/feed/<id>/` (`bcbptax`, `b3cotahist`, `ecb`) | `NewSources` and `SourceIDs` in `internal/marketdata/sources.go` | `internal/marketdata/region_defaults.go` (`SuggestedFeeds`): a suggestion enables nothing; an admin enables sources on the settings screen (ADR 025) and `EQUORI_FEED_<ID>_URL` sets an address | `internal/marketdata/sources_test.go`, `<id>_test.go` in the implementation directory |
| Index source | `internal/marketdata/internal/index/index.go` (`Source`) | `internal/marketdata/internal/index/<id>/` (`brsgs`, `cpi`, `overnight`) | `NewIndexSources` and `IndexSourceIDs` in `internal/marketdata/indexes.go` | `internal/marketdata/region_defaults.go` (`SuggestedFeeds`), as for price sources | `internal/marketdata/indexes_test.go` |
| Expectation source | `internal/marketdata/internal/expectation/expectation.go` (`Source`) | `internal/marketdata/internal/expectation/<id>/` (`brfocus`) | `NewExpectationSources` and `ExpectationSourceIDs` in `internal/marketdata/expectations.go` | `internal/marketdata/region_defaults.go` (`SuggestedFeeds`); an admin enables it on the settings screen (ADR 026) | `internal/marketdata/expectations_test.go`, `<id>_test.go` in the implementation directory |
| Institution identifier scheme | `internal/ledger/internal/domain/identifier.go` (`IdentifierScheme`) | Same file: one entry of `IdentifierSchemes` (`bic`, `br_ispb`) | `IdentifierSchemes` and `ValidateIdentifier` in the same file | None: the scheme is set per institution | `internal/ledger/institution_test.go` |
| Foreign charge | `internal/ledger/region_defaults.go` | Same file | None | `internal/ledger/region_defaults.go` (`DefaultForeignChargeBP`, basis points; `BR` 350, any other region 0) | `internal/ledger/foreign_charge_test.go` |
| Income withholding | `internal/ledger/region_defaults.go` | Same file | None | `internal/ledger/region_defaults.go` (`DefaultWithholdingBP`, basis points; `BR` with `jcp` 1500, any other pair 0) | `internal/ledger/withholding_test.go` |
| Base currency | `internal/ledger/region_defaults.go` | Same file | None | `internal/ledger/region_defaults.go` (`DefaultBaseCurrency`; a region without an entry requires the user to choose) | `internal/ledger/provisioning_test.go` |
| Jurisdiction (tax class, treatment, income types, subtypes, `TaxYear`: the tax year of the jurisdiction, the calendar year when neutral) | `internal/portfolio/internal/domain/jurisdiction.go` (`Jurisdiction`) | `internal/portfolio/internal/jurisdiction/<id>/` (`br`) | `New` in `internal/portfolio/portfolio.go` | `internal/portfolio/region_defaults.go` (`defaultJurisdiction`) | `internal/portfolio/jurisdiction_test.go`, `internal/portfolio/internal/jurisdiction/br/br_test.go` |
| Aggregator | `internal/ingestion/internal/app/integration.go` (`Aggregator`) | `internal/ingestion/internal/aggregator/<id>/` (`pluggy`) | `New` and `AggregatorIDs` in `internal/ingestion/ingestion.go` | None: the instance sets an address with `EQUORI_AGGREGATOR_<ID>_URL` | `internal/ingestion/aggregators_test.go`, `port_test.go` in the implementation directory |
| File encoding | `internal/ingestion/internal/charset/registry.go` (`Decoder`, `Names`) | Same file: one case of `Decoder` | `Decoder` | None: the CSV profile field `encoding` holds the name (`auto` by default) | `internal/ingestion/internal/charset/charset_test.go`, `internal/ingestion/internal/csvfile/csvfile_test.go` |
| CSV number and date reading | `internal/ingestion/internal/domain/profile.go` (profile fields `date_layout`, `group_separator`) | Profile data, not code | None | The CSV profile of the account | `internal/ingestion/internal/csvfile/csvfile_test.go`, `internal/ingestion/profile_test.go` |
| Capture lexicon | `internal/capture/internal/domain/lexicon.go` (`Lexicon`, `Merge`) | `internal/capture/internal/domain/lexicon_pt.go` (`Portuguese`), `lexicon_en.go` (`English`) | `lexiconOf` in `internal/capture/internal/app/service.go` | `lexiconOf` selects by profile language; a language without a lexicon reads with `English` | `internal/capture/internal/domain/lexicon_test.go`, `internal/capture/locale_test.go` |
| Locale conventions | `internal/platform/locale/conventions.go` (`Conventions`, `ConventionsOf`) | Same file: one case of `ConventionsOf` | `ConventionsOf` | Same function: the region selects the decimal separator, the group separator and the date order | `internal/platform/locale/locale_test.go` |
| Installer language | `packaging/windows/equori.iss` (`[Languages]`) | Same file: one `[Languages]` entry and its `[CustomMessages]` per web catalog | None | None: the Windows display language selects it; it sets no language or region of a user | `scripts/windows-smoke.ps1` compiles and installs the script |

Capture reads its separators and date order from `locale.ConventionsOf` through `domain.Conventions` in `internal/capture/internal/domain/conventions.go`.

## Web files

| File | Content | Test file |
|---|---|---|
| `web/src/i18n/languages.ts` | `languages`: language code, native name, catalog, optional Slotted locale | `web/src/i18n/languages.test.ts` |
| `web/src/i18n/catalog.en.ts`, `catalog.pt-BR.ts`, `catalog-accounts.en.ts`, `catalog-accounts.pt-BR.ts` | One message catalog per language | `web/src/i18n/i18n-provider.test.tsx` |
| `web/src/i18n/regions.ts` | `regions`: the ISO 3166-1 alpha-2 codes, in the order of `internal/platform/locale/regions.go` | None |
| `web/src/i18n/locale.ts` | `Locale` and `tagOf`: the `language-region` tag passed to `Intl` | `web/src/i18n/format.test.ts` |
| `web/src/features/accounts/institution-logo.ts` | `logoOf`: a `switch` on the identifier scheme that returns a logo URL; a scheme without a case has no logo (ADR 013) | `web/src/features/accounts/institution-logo.test.ts` |
| `web/src/features/calculators/fixed-income-region.ts` | `fixedIncomeRules`: a `switch` on the region that returns the tax on fixed-income yield; a region without a case asks for the rate | `web/src/features/calculators/fixed-income-region.test.ts` |
| `web/src/features/calculators/credit-cost-calculator.tsx` | `regionalTerms`: a `switch` on the region that returns the name the region gives the effective annual cost of credit (CET in Brazil) and the nominal rate its contracts state beside it (APR in the United States); a region without a case has neither | `web/src/features/calculators/credit-cost-calculator.test.tsx` |
| `web/src/features/calculators/financing-region.ts` | `systemNames`: a `switch` on the region that returns the names of the fixed-installment and fixed-amortization systems (Price and SAC in Brazil); a region without a case names them by what each keeps fixed | `web/src/features/calculators/financing-calculator.test.tsx` |
| `web/src/features/calculators/debt-region.ts` | `debtRateQuote`: a `switch` on the region that returns the period a debt's rate is quoted in and whether an annual rate is nominal (an APR in the United States); a region without a case quotes a monthly rate | `web/src/features/calculators/debt-region.test.ts` |

## Checklist

1. Add the region code to `internal/platform/locale/regions.go` and `web/src/i18n/regions.ts` when absent. The two lists stay identical.
2. Add a case to `ConventionsOf` in `internal/platform/locale/conventions.go` when the region does not use the fallback conventions (`.` decimal, `,` group, `ymd`). Cover it in `internal/platform/locale/locale_test.go`.
3. Add a case for the region to `DefaultBaseCurrency`, `DefaultForeignChargeBP`, `DefaultWithholdingBP`, `DefaultCalendar` and `defaultJurisdiction`. A function without a case for the region returns its neutral value.
4. Add a calendar: a Go value in `internal/marketdata/internal/calendar/<id>.go`, an entry in `marketdata.New`, and a test of its holidays against an official source.
5. Add a jurisdiction: a package `internal/portfolio/internal/jurisdiction/<id>/` implementing `Jurisdiction`, an entry in `portfolio.New`, and a test of tax class, treatment and the `TaxYear` range.
6. Add a price source: a package `internal/marketdata/internal/feed/<id>/` implementing `Source`, an entry in `sourceEntries` in `internal/marketdata/sources.go` with its publication lag, a case in `SuggestedFeeds` for its region, a test against a fixture in `testdata/`, and a line in `docs/operations/price-feeds.md`.
7. Add an index source: a package `internal/marketdata/internal/index/<id>/` implementing `Source`, an entry in `indexEntries` in `internal/marketdata/indexes.go` with its publication lag, a case in `SuggestedFeeds` for its region, a test against a fake server, and the identifier in the `EQUORI_INDEX_FEEDS` line of `docs/operations/price-feeds.md`.
8. Add an expectation source: a package `internal/marketdata/internal/expectation/<id>/` implementing `Source`, an entry in `expectationEntries` in `internal/marketdata/expectations.go` with its publication lag, a case in `SuggestedFeeds` for its region, and a test against a fake server.
9. Add an institution identifier scheme: an entry in `IdentifierSchemes`, and a case in `logoOf` when a logo source exists.
10. Add an aggregator: a package `internal/ingestion/internal/aggregator/<id>/` implementing `Aggregator`, an entry in `New` and `AggregatorIDs` in `internal/ingestion/ingestion.go`, and a test against a fake server.
11. Add a file encoding: a case in `Decoder` in `internal/ingestion/internal/charset/registry.go`.
12. Add a capture lexicon: a file `internal/capture/internal/domain/lexicon_<language>.go`, a case in `lexiconOf`, and a test in `lexicon_test.go`.
13. Add a language: an entry in `languages` in `web/src/i18n/languages.ts` and the two catalogs.
14. Run `make check`.

A registry rejects a duplicate or malformed identifier at startup. An unknown identifier in `EQUORI_PRICE_FEEDS` or `EQUORI_INDEX_FEEDS` stops the process with the variable name and the identifier.
