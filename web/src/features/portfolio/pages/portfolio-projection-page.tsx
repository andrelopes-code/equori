import { ButtonLink } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Page, PageBody } from "@slotted/react/page";

import { PortfolioAreaHeader } from "@/features/portfolio/area-header/portfolio-area-header";
import { ProjectionBody } from "@/features/portfolio/projection/projection-body";
import { useProjection } from "@/features/portfolio/projection/use-projection";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";
import { PageStack } from "@/ui/page-layout/page-stack";

// PX1 to PX3, PX11, PX12: the plan of the member and, under it, what the plan leads to.
export function PortfolioProjectionPage() {
  const t = useT();
  const projection = useProjection();

  return (
    <Page width="full">
      <PortfolioAreaHeader
        tab="projection"
        subheading={t("portfolio.projection.subtitle")}
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
      />

      <PageBody>
        <PageStack>
          <ProjectionBody projection={projection} />
        </PageStack>
      </PageBody>
    </Page>
  );
}
