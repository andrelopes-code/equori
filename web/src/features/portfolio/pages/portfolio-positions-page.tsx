import { ButtonLink } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Page, PageBody } from "@slotted/react/page";

import { WhereMoneySection } from "@/features/portfolio/allocation/where-money-section";
import { PortfolioAreaHeader } from "@/features/portfolio/area-header/portfolio-area-header";
import { ValuationDateInput } from "@/features/portfolio/area-header/valuation-date-input";
import { ValueInSelect } from "@/features/portfolio/area-header/value-in-select";
import { FixedIncomePanel } from "@/features/portfolio/fixed-income/fixed-income-panel";
import { HoldingsSection } from "@/features/portfolio/holdings/holdings-section";
import { PortfolioEmpty } from "@/features/portfolio/notices/portfolio-empty";
import { PortfolioProblem } from "@/features/portfolio/notices/portfolio-problem";
import { usePortfolioView } from "@/features/portfolio/pages/use-portfolio-view";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";
import { PageStack } from "@/ui/page-layout/page-stack";

// PT2: "Onde está o dinheiro", "Renda fixa" and the positions grid, each under its condition of the former page.
export function PortfolioPositionsPage() {
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
    accounts,
    names,
    empty,
    hasBrokerage,
    change,
  } = usePortfolioView();

  const canTrade = hasBrokerage && !empty && !positions.isError;

  return (
    <Page width="full">
      <PortfolioAreaHeader
        tab="positions"
        subheading={t("portfolio.positions.subtitle")}
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

          {!empty && !positions.isError && (
            <FixedIncomePanel holdings={holdings} date={date} />
          )}

          {!empty && !positions.isError && (
            <HoldingsSection
              holdings={holdings}
              accounts={accounts.data ?? []}
              institutions={names}
              by={by}
              date={date}
              valueIn={valueIn}
              unpriced={summary.unpriced}
              pending={pending}
            />
          )}
        </PageStack>
      </PageBody>
    </Page>
  );
}
