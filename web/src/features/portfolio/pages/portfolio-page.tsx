import { Page, PageBody } from "@slotted/react/page";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { riskQuery } from "@/features/portfolio/api";
import { FixedIncomePanel } from "@/features/portfolio/fixed-income/fixed-income-panel";
import { HoldingsSection } from "@/features/portfolio/holdings/holdings-section";
import { PortfolioHeader } from "@/features/portfolio/summary/portfolio-header";
import { PortfolioEmpty } from "@/features/portfolio/notices/portfolio-empty";
import { PortfolioProblem } from "@/features/portfolio/notices/portfolio-problem";
import { PortfolioReturn } from "@/features/portfolio/return/portfolio-return";
import { RiskSection } from "@/features/portfolio/risk/risk-section";
import type { SearchPatch } from "@/features/portfolio/model/portfolio-search";
import { PortfolioSummary } from "@/features/portfolio/summary/portfolio-summary";
import { QuoteWarningsNotice } from "@/features/portfolio/notices/quote-warnings-notice";
import { useHoldings } from "@/features/portfolio/holdings/use-holdings";
import { WhereMoneySection } from "@/features/portfolio/allocation/where-money-section";
import { institutionsQuery, settingsQuery } from "@/features/setup";
import { useToday } from "@/i18n/today";
import { PageStack } from "@/ui/page-layout/page-stack";

// PC1: how much there is and what it made, how it performed, where it is, then every row.
export function PortfolioPage() {
  const today = useToday();
  const api = useApi();
  const search = useSearch({ from: "/_authed/portfolio" });
  const navigate = useNavigate();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const institutions = useQuery(institutionsQuery(api));

  const date = search.date ?? today;
  const valueIn = search.value_in ?? base;
  // The risk report takes seconds on a long book: it starts with the positions, not after them.
  useQuery({
    ...riskQuery(api, date, valueIn),
    enabled: valueIn !== undefined,
  });
  const by = search.by ?? "type";
  const { holdings, summary, pending, positions, accounts } = useHoldings(
    date,
    valueIn,
  );
  const names = new Map((institutions.data ?? []).map((i) => [i.id, i.name]));
  const empty = !pending && holdings.length === 0;
  const hasBrokerage = (accounts.data ?? []).some(
    (a) => a.kind === "brokerage" && a.parent_id === undefined,
  );

  function change(patch: SearchPatch) {
    const next = Object.fromEntries(
      Object.entries({ ...search, ...patch }).filter(
        ([, value]) => value !== undefined,
      ),
    );

    void navigate({ to: "/portfolio", search: next, replace: true });
  }

  return (
    <Page width="full">
      <PortfolioHeader
        date={date}
        today={today}
        valueIn={valueIn}
        base={base}
        canTrade={hasBrokerage && !empty && !positions.isError}
        onChange={change}
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
            <RiskSection date={date} valueIn={valueIn} total={summary.total} />
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
