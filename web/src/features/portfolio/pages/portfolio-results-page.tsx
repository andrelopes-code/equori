import { ButtonLink } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Page, PageBody } from "@slotted/react/page";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { PortfolioAreaHeader } from "@/features/portfolio/area-header/portfolio-area-header";
import { ValueInSelect } from "@/features/portfolio/area-header/value-in-select";
import { AttributionSection } from "@/features/portfolio/attribution/attribution-section";
import { settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { PageStack } from "@/ui/page-layout/page-stack";
import { routeTo } from "@/ui/navigation/route-to";

// PT2: the results of the portfolio; this plan holds "Rendimento por ativo" only.
export function PortfolioResultsPage() {
  const t = useT();
  const api = useApi();
  const search = useSearch({ from: "/_authed/portfolio/results" });
  const navigate = useNavigate();
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  const valueIn = search.value_in ?? base;

  function handleValueIn(next: string | undefined) {
    const kept = Object.fromEntries(
      Object.entries({ ...search, value_in: next }).filter(
        ([, value]) => value !== undefined,
      ),
    );

    void navigate({ to: "/portfolio/results", search: kept, replace: true });
  }

  return (
    <Page width="full">
      <PortfolioAreaHeader
        tab="results"
        subheading={t("portfolio.results.subtitle")}
        controls={
          <ValueInSelect
            valueIn={valueIn}
            base={base}
            onChange={handleValueIn}
          />
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
          <AttributionSection />
        </PageStack>
      </PageBody>
    </Page>
  );
}
