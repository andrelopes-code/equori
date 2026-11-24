import { ButtonLink } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Page, PageBody } from "@slotted/react/page";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { PortfolioAreaHeader } from "@/features/portfolio/area-header/portfolio-area-header";
import { ValueInSelect } from "@/features/portfolio/area-header/value-in-select";
import { ResultsAccountSelect } from "@/features/portfolio/results/results-account-select";
import { ResultsBody } from "@/features/portfolio/results/results-body";
import { useResults } from "@/features/portfolio/results/use-results";
import { useResultsSearch } from "@/features/portfolio/results/use-results-search";
import { settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { PageStack } from "@/ui/page-layout/page-stack";
import { routeTo } from "@/ui/navigation/route-to";

// PT2, PR1 to PR11: the period bar, the four blocks and "Rendimento por ativo", or the state the read is in.
export function PortfolioResultsPage() {
  const t = useT();
  const api = useApi();
  const [search, patch] = useResultsSearch();
  const results = useResults();
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  const valueIn = search.value_in ?? base;

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
          <ButtonLink
            start={<Glyph name="plus" />}
            render={routeTo({
              to: "/transactions/new",
              search: { kind: "trade" },
            })}
          >
            {t("holdings.trade")}
          </ButtonLink>
        }
        help="portfolio"
        valueIn={search.value_in}
      />
      <PageBody>
        <PageStack>
          <ResultsBody results={results} />
        </PageStack>
      </PageBody>
    </Page>
  );
}
