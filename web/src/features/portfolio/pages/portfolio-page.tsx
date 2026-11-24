import { ButtonLink } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Page, PageBody } from "@slotted/react/page";

import { PortfolioAreaHeader } from "@/features/portfolio/area-header/portfolio-area-header";
import { ValuationDateInput } from "@/features/portfolio/area-header/valuation-date-input";
import { ValueInSelect } from "@/features/portfolio/area-header/value-in-select";
import { WhereMoneySection } from "@/features/portfolio/allocation/where-money-section";
import { PortfolioEmpty } from "@/features/portfolio/notices/portfolio-empty";
import { PortfolioProblem } from "@/features/portfolio/notices/portfolio-problem";
import { QuoteWarningsNotice } from "@/features/portfolio/notices/quote-warnings-notice";
import { usePortfolioView } from "@/features/portfolio/pages/use-portfolio-view";
import { PortfolioReturn } from "@/features/portfolio/return/portfolio-return";
import { PortfolioSummary } from "@/features/portfolio/summary/portfolio-summary";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";
import { PageStack } from "@/ui/page-layout/page-stack";

// PC1, PT2: how much there is and what it made, how it performed, where it is.
export function PortfolioPage() {
  const t = useT();
  const {
    today,
    search,
    date,
    valueIn,
    base,
    by,
    holdings,
    summary,
    pending,
    positions,
    names,
    empty,
    hasBrokerage,
    change,
  } = usePortfolioView("/portfolio");

  const canTrade = hasBrokerage && !empty && !positions.isError;

  return (
    <Page width="full">
      <PortfolioAreaHeader
        tab="summary"
        subheading={t("holdings.subtitle")}
        controls={
          <>
            <ValueInSelect
              valueIn={valueIn}
              base={base}
              onChange={(next) => {
                change({ value_in: next });
              }}
            />
            <ValuationDateInput
              date={date}
              today={today}
              onChange={(next) => {
                change({ date: next });
              }}
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
              date={date}
              onBase={() => {
                change({ value_in: undefined });
              }}
              onRetry={() => void positions.refetch()}
            />
          )}

          {empty && !positions.isError && (
            <PortfolioEmpty hasBrokerage={hasBrokerage} />
          )}

          {!empty && !positions.isError && (
            <QuoteWarningsNotice date={date} valueIn={valueIn} />
          )}

          {!empty && !positions.isError && (
            <PortfolioSummary
              summary={summary}
              date={date}
              valueIn={valueIn}
              base={base}
              pending={pending}
            />
          )}

          <PortfolioReturn
            date={date}
            valueIn={valueIn}
            search={search}
            onChange={change}
          />

          {!empty && !positions.isError && (
            <WhereMoneySection
              holdings={holdings}
              institutions={names}
              by={by}
              total={summary.total}
              valueIn={valueIn}
              pending={pending}
              onBy={(next) => {
                change({ by: next === "type" ? undefined : next });
              }}
            />
          )}
        </PageStack>
      </PageBody>
    </Page>
  );
}
