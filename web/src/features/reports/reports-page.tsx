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
import { Tab, TabList, Tabs } from "@slotted/react/tabs";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";

import { useApi } from "@/api/api-context";
import { NetWorthTab } from "@/features/reports/net-worth-tab";
import { netWorthSpans, reportsTabs } from "@/features/reports/reports-search";
import type {
  NetWorthMonths,
  ReportsPatch,
  ReportsTab,
} from "@/features/reports/reports-search";
import { ValuationCurrency } from "@/features/reports/valuation-currency";
import { settingsQuery } from "@/features/setup";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { HeaderProgress } from "@/ui/header-progress";

const tabLabels: Record<ReportsTab, MessageKey> = {
  "net-worth": "report.tab.netWorth",
  categories: "report.tab.categories",
  flows: "report.tab.flows",
};

// What the books held and moved over time, one tab per report. The state of the tab lives in
// the address, so a link reopens the same report.
export function ReportsPage() {
  const t = useT();
  const api = useApi();
  const search = useSearch({ from: "/_authed/reports" });
  const navigate = useNavigate();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const current: ReportsTab = search.tab ?? "net-worth";
  const valueIn = search.value_in ?? base;
  const count: NetWorthMonths = search.months ?? 12;
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
            <PageHeaderActions>
              {current === "net-worth" && (
                <>
                  <ValuationCurrency
                    value={valueIn}
                    onChange={(code) => {
                      void change({
                        value_in: code === base ? undefined : code,
                      });
                    }}
                  />
                  <SegmentedControl
                    size="sm"
                    aria-label={t("report.netWorth.span")}
                    value={String(count)}
                    onValueChange={(value) => {
                      const next = netWorthSpans.find(
                        (n) => String(n) === value,
                      );
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
            </PageHeaderActions>
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
            <NetWorthTab count={count} valueIn={valueIn} />
          )}
        </div>
      </PageBody>
    </Page>
  );
}
