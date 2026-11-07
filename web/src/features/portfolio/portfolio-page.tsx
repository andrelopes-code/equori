import { ButtonLink } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { HoldingsSection } from "@/features/portfolio/holdings-section";
import { PortfolioHeader } from "@/features/portfolio/portfolio-header";
import { PortfolioProblem } from "@/features/portfolio/portfolio-problem";
import { PortfolioReturn } from "@/features/portfolio/portfolio-return";
import type { SearchPatch } from "@/features/portfolio/portfolio-search";
import { PortfolioSummary } from "@/features/portfolio/portfolio-summary";
import { useHoldings } from "@/features/portfolio/use-holdings";
import { WhereMoneySection } from "@/features/portfolio/where-money-section";
import { institutionsQuery, settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// PC1: how much there is and what it made, how it performed, where it is, then every row.
export function PortfolioPage() {
  const t = useT();
  const today = useToday();
  const api = useApi();
  const search = useSearch({ from: "/_authed/portfolio" });
  const navigate = useNavigate();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const institutions = useQuery(institutionsQuery(api));

  const date = search.date ?? today;
  const valueIn = search.value_in ?? base;
  const by = search.by ?? "type";
  const { holdings, summary, pending, positions, accounts } = useHoldings(
    date,
    valueIn,
  );
  const names = new Map((institutions.data ?? []).map((i) => [i.id, i.name]));
  const empty = !pending && holdings.length === 0;

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
        onChange={change}
      />
      <PageBody>
        <Stack gap={6}>
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
            <ResultState status="empty" reach="section">
              <ResultStateContent>
                <ResultStateTitle>{t("portfolio.empty")}</ResultStateTitle>
                <ResultStateDescription>
                  {t("portfolio.emptyHint")}
                </ResultStateDescription>
              </ResultStateContent>
              <ButtonLink
                render={(props) => (
                  <Link
                    {...props}
                    to="/transactions/new"
                    search={{ kind: "trade" }}
                  />
                )}
              >
                {t("holdings.trade")}
              </ButtonLink>
            </ResultState>
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
        </Stack>
      </PageBody>
    </Page>
  );
}
