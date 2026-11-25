import { ButtonLink } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Page, PageBody } from "@slotted/react/page";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { PortfolioAreaHeader } from "@/features/portfolio/area-header/portfolio-area-header";
import { ValueInSelect } from "@/features/portfolio/area-header/value-in-select";
import { useHoldings } from "@/features/portfolio/holdings/use-holdings";
import { PortfolioEmpty } from "@/features/portfolio/notices/portfolio-empty";
import { PortfolioProblem } from "@/features/portfolio/notices/portfolio-problem";
import { QuoteWarningsNotice } from "@/features/portfolio/notices/quote-warnings-notice";
import { ResultsAccountSelect } from "@/features/portfolio/results/results-account-select";
import { ResultsBody } from "@/features/portfolio/results/results-body";
import { useResults } from "@/features/portfolio/results/use-results";
import { useResultsSearch } from "@/features/portfolio/results/use-results-search";
import { PortfolioSummary } from "@/features/portfolio/summary/portfolio-summary";
import { settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { routeTo } from "@/ui/navigation/route-to";
import { PageStack } from "@/ui/page-layout/page-stack";

// PT2, PT5, PR1 to PR11: the quote warnings, the four figures at today's date, the period bar, the
// four blocks and "Rendimento por ativo", or the state the read is in.
export function PortfolioResultsPage() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const [search, patch] = useResultsSearch();
  const results = useResults();
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  const valueIn = search.value_in ?? base;
  const { holdings, summary, pending, positions, accounts } = useHoldings(
    today,
    valueIn,
  );
  const empty = !pending && holdings.length === 0;
  const hasBrokerage = (accounts.data ?? []).some(
    (a) => a.kind === "brokerage" && a.parent_id === undefined,
  );
  const ready = !empty && !positions.isError;
  const canTrade = hasBrokerage && ready;

  function handleValueIn(next: string | undefined) {
    patch({ value_in: next });
  }

  return (
    <Page width="full">
      <PortfolioAreaHeader
        tab="results"
        subheading={t("portfolio.results.subtitle")}
        controls={
          <>
            <ResultsAccountSelect />

            <ValueInSelect
              valueIn={valueIn}
              base={base}
              onChange={handleValueIn}
            />
          </>
        }
        actions={
          canTrade && (
            <ButtonLink
              start={<Glyph name="plus" />}
              render={routeTo({
                to: "/transactions/new",
                search: { kind: "trade" },
              })}
            >
              {t("holdings.trade")}
            </ButtonLink>
          )
        }
        help="portfolio"
        valueIn={search.value_in}
      />
      <PageBody>
        <PageStack>
          {positions.isError && (
            <PortfolioProblem
              error={positions.error}
              currency={valueIn}
              date={today}
              onBase={() => {
                handleValueIn(undefined);
              }}
              onRetry={() => void positions.refetch()}
            />
          )}

          {empty && !positions.isError && (
            <PortfolioEmpty hasBrokerage={hasBrokerage} />
          )}

          {ready && <QuoteWarningsNotice date={today} valueIn={valueIn} />}

          {ready && (
            <PortfolioSummary
              summary={summary}
              date={today}
              valueIn={valueIn}
              base={base}
              pending={pending}
            />
          )}

          {ready && <ResultsBody results={results} />}
        </PageStack>
      </PageBody>
    </Page>
  );
}
