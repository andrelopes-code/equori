import { Button } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderArea,
  PageHeaderContent,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTabs,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Tab, TabList, Tabs } from "@slotted/react/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { HeaderProgress } from "@/ui/header-progress";
import { PeriodControl } from "@/ui/period-control";
import { RefreshButton } from "@/ui/refresh-button";
import { useRefresh } from "@/ui/use-refresh";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";
import { useApi } from "@/api/api-context";
import { useScale } from "@/features/setup";
import {
  transactionKeys,
  uncategorizedCountQuery,
} from "@/features/transactions/api";
import { PeriodSummary } from "@/features/transactions/period-summary";
import type {
  TransactionSearch,
  TransactionSearchDraft,
} from "@/features/transactions/search";
import { usePeriodTotals } from "@/features/transactions/use-period-totals";
import { useT } from "@/i18n/i18n-provider";

interface TransactionsHeaderProps {
  search: TransactionSearch;
  shown: TransactionSearch;
  listRefreshing: boolean;
  onSearchChange: (next: TransactionSearchDraft) => void;
  listID: string;
}

export function TransactionsHeader({
  search,
  shown,
  listRefreshing,
  onSearchChange,
  listID,
}: TransactionsHeaderProps) {
  const t = useT();

  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/transactions" });
  const periodTotals = usePeriodTotals(shown);
  const uncategorized = useQuery(uncategorizedCountQuery(api));
  const scale = useScale();
  const compact = useMediaQuery(compactQuery);
  const refresh = useRefresh(() =>
    queryClient.invalidateQueries({
      queryKey: transactionKeys.all,
    }),
  );

  const queue = search.uncategorized === true;
  const queueLabel =
    uncategorized.data === undefined
      ? t("transactions.tab.uncategorized")
      : t("transactions.tab.uncategorizedCount", {
          count: uncategorized.data.more
            ? `${String(uncategorized.data.count)}+`
            : uncategorized.data.count,
        });

  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{t("nav.transactions")}</PageHeaderHeading>
            <PageHeaderSubheading>
              {t("transactions.subtitle")}
            </PageHeaderSubheading>
          </PageHeaderTitle>

          <PageHeaderActions>
            <PeriodControl
              value={
                search.from !== undefined && search.to !== undefined
                  ? { from: search.from, to: search.to }
                  : undefined
              }
              onChange={(period) => {
                onSearchChange({
                  ...search,
                  from: period?.from,
                  to: period?.to,
                });
              }}
            />
            <RefreshButton
              label={t("transactions.refresh")}
              refreshing={refresh.refreshing}
              onRefresh={refresh.refresh}
            />
            {!compact && (
              <Button
                start={
                  <Icon size="sm">
                    <Glyph name="plus" />
                  </Icon>
                }
                onClick={() => {
                  void navigate({ to: "/transactions/new" });
                }}
              >
                {t("nav.new")}
              </Button>
            )}
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>

      {periodTotals.totals !== null && scale !== null && (
        <PageHeaderArea>
          <PageHeaderContent>
            <PeriodSummary totals={periodTotals.totals} scale={scale} />
          </PageHeaderContent>
        </PageHeaderArea>
      )}

      <PageHeaderTabs>
        <Tabs
          value={queue ? "queue" : "all"}
          onValueChange={(tab) => {
            onSearchChange({
              ...search,
              ...(tab === "queue"
                ? { uncategorized: true as const }
                : { uncategorized: undefined }),
            });
          }}
        >
          <TabList aria-label={t("nav.transactions")}>
            <Tab value="all" controls={listID}>
              {t("transactions.tab.all")}
            </Tab>
            <Tab value="queue" controls={listID}>
              {queueLabel}
            </Tab>
          </TabList>
        </Tabs>
      </PageHeaderTabs>

      <HeaderProgress
        loading={refresh.refreshing || listRefreshing}
        {...(refresh.refreshing ? { delay: 0 } : {})}
      />
    </PageHeader>
  );
}
