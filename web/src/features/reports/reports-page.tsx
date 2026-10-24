import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTabs,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { Switch } from "@slotted/react/switch";
import { Tab, TabList, Tabs } from "@slotted/react/tabs";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";

import { useApi } from "@/api/api-context";
import { CategoriesTab } from "@/features/reports/categories-tab";
import { FlowsTab } from "@/features/reports/flows-tab";
import { NetWorthTab } from "@/features/reports/net-worth-tab";
import { periodLabel } from "@/features/reports/period-label";
import { ReportPeriodControl } from "@/features/reports/report-period-control";
import { defaultPeriod } from "@/features/reports/report-period";
import { netWorthSpans, reportsTabs } from "@/features/reports/reports-search";
import type {
  NetWorthMonths,
  ReportsPatch,
  ReportsTab,
} from "@/features/reports/reports-search";
import { ValuationCurrency } from "@/features/reports/valuation-currency";
import { settingsQuery } from "@/features/setup";
import type { MessageKey } from "@/i18n/catalog.en";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { HeaderProgress } from "@/ui/header-progress";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

const tabLabels: Record<ReportsTab, MessageKey> = {
  "net-worth": "report.tab.netWorth",
  categories: "report.tab.categories",
  flows: "report.tab.flows",
};

// What the books held and moved over time, one tab per report. The state of the tab lives in
// the address, so a link reopens the same report.
export function ReportsPage() {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();
  const compact = useMediaQuery(compactQuery);
  const api = useApi();
  const search = useSearch({ from: "/_authed/reports" });
  const navigate = useNavigate();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const current: ReportsTab = search.tab ?? "net-worth";
  const valueIn = search.value_in ?? base;
  const count: NetWorthMonths = search.months ?? 12;
  const fallback = defaultPeriod(today);
  const period = {
    from: search.from ?? fallback.from,
    to: search.to ?? fallback.to,
  };
  // CP-09: the strip moves at once; the tab's region renders from the deferred value.
  const [chosen, setChosen] = useState<ReportsTab | null>(null);
  const shownTab = useDeferredValue(chosen ?? current);
  const change = (patch: ReportsPatch) => {
    const next = Object.fromEntries(
      Object.entries({ ...search, ...patch }).filter(
        ([, value]) => value !== undefined,
      ),
    );
    return navigate({ to: "/reports", search: next, replace: true });
  };
  const controls = (
    <>
      {current === "net-worth" && (
        <>
          <ValuationCurrency
            value={valueIn}
            onChange={(code) => {
              void change({ value_in: code === base ? undefined : code });
            }}
          />
          <SegmentedControl
            size="sm"
            aria-label={t("report.netWorth.span")}
            value={String(count)}
            onValueChange={(value) => {
              const next = netWorthSpans.find((n) => String(n) === value);
              if (next !== undefined)
                void change({ months: next === 12 ? undefined : next });
            }}
          >
            {netWorthSpans.map((n) => (
              <Segment key={n} value={String(n)}>
                {t("report.netWorth.months", { count: n })}
              </Segment>
            ))}
          </SegmentedControl>
        </>
      )}
      {current !== "net-worth" && (
        <>
          <ReportPeriodControl
            value={period}
            onChange={(next) => {
              const isDefault =
                next.from === fallback.from && next.to === fallback.to;
              void change({
                from: isDefault ? undefined : next.from,
                to: isDefault ? undefined : next.to,
                parent: undefined,
              });
            }}
          />
          {current === "categories" && (
            <SegmentedControl
              size="sm"
              aria-label={t("report.class")}
              value={search.class ?? "expense"}
              onValueChange={(value) => {
                void change({
                  class: value === "income" ? "income" : undefined,
                  parent: undefined,
                });
              }}
            >
              <Segment value="expense">{t("report.class.expense")}</Segment>
              <Segment value="income">{t("report.class.income")}</Segment>
            </SegmentedControl>
          )}
          <Switch
            checked={search.compare === true}
            onCheckedChange={(checked) => {
              void change({ compare: checked ? true : undefined });
            }}
          >
            {t("report.compare")}
          </Switch>
        </>
      )}
    </>
  );
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.reports")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("report.subtitle")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>{!compact && controls}</PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
        <PageHeaderTabs>
          <Tabs
            value={chosen ?? current}
            onValueChange={(value) => {
              const tab = reportsTabs.find((e) => e === value);
              if (tab === undefined) return;
              setChosen(tab);
              void change({ tab: tab === "net-worth" ? undefined : tab }).then(
                () => {
                  setChosen(null);
                },
              );
            }}
          >
            <TabList aria-label={t("report.tabs")}>
              {reportsTabs.map((tab) => (
                <Tab key={tab} value={tab}>
                  {t(tabLabels[tab])}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </PageHeaderTabs>
        <HeaderProgress loading={shownTab !== (chosen ?? current)} />
      </PageHeader>
      <PageBody>
        {compact && <Stack gap={3}>{controls}</Stack>}
        <div aria-busy={shownTab !== (chosen ?? current) || undefined}>
          {shownTab === "net-worth" && (
            <NetWorthTab count={count} valueIn={valueIn} />
          )}
          {shownTab === "flows" && (
            <FlowsTab
              period={period}
              search={search}
              onChange={(patch) => {
                void change(patch);
              }}
            />
          )}
          {shownTab === "categories" && (
            <CategoriesTab
              period={period}
              search={search}
              label={periodLabel(period, t, tag)}
            />
          )}
        </div>
      </PageBody>
    </Page>
  );
}
