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
import { Tab, TabList, Tabs } from "@slotted/react/tabs";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";

import { useApi } from "@/api/api-context";
import { CategoriesTab } from "@/features/reports/categories-tab";
import { FlowsTab } from "@/features/reports/flows-tab";
import { NetWorthTab } from "@/features/reports/net-worth-tab";
import { periodLabel } from "@/features/reports/period-label";
import { defaultPeriod } from "@/features/reports/report-period";
import { reportsTabs } from "@/features/reports/reports-search";
import type {
  NetWorthMonths,
  ReportsPatch,
  ReportsTab,
} from "@/features/reports/reports-search";
import { settingsQuery } from "@/features/setup";
import type { MessageKey } from "@/i18n/catalog.en";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { HeaderProgress } from "@/ui/header-progress";
import { PeriodControl } from "@/ui/period-control";

const tabLabels: Record<ReportsTab, MessageKey> = {
  "net-worth": "report.tab.netWorth",
  categories: "report.tab.categories",
  flows: "report.tab.flows",
};

// What the books held and moved over time, one tab per report. The state of the tab lives in
// the address, so a link reopens the same report. The period stands in the header as on the
// transactions page; each tab's own controls stand in the first row of its body.
export function ReportsPage() {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();
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
  const onChange = (patch: ReportsPatch) => {
    void change(patch);
  };
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
            {current !== "net-worth" && (
              <PageHeaderActions>
                <PeriodControl
                  quarters
                  allowAll={false}
                  value={period}
                  onChange={(next) => {
                    if (next === undefined) return;
                    const isDefault =
                      next.from === fallback.from && next.to === fallback.to;
                    onChange({
                      from: isDefault ? undefined : next.from,
                      to: isDefault ? undefined : next.to,
                      parent: undefined,
                    });
                  }}
                />
              </PageHeaderActions>
            )}
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
        <div aria-busy={shownTab !== (chosen ?? current) || undefined}>
          {shownTab === "net-worth" && (
            <NetWorthTab
              count={count}
              valueIn={valueIn}
              onCount={(next) => {
                onChange({ months: next === 12 ? undefined : next });
              }}
              onValueIn={(code) => {
                onChange({ value_in: code === base ? undefined : code });
              }}
            />
          )}
          {shownTab === "categories" && (
            <CategoriesTab
              period={period}
              search={search}
              label={periodLabel(period, t, tag)}
              onChange={onChange}
            />
          )}
          {shownTab === "flows" && (
            <FlowsTab period={period} search={search} onChange={onChange} />
          )}
        </div>
      </PageBody>
    </Page>
  );
}
