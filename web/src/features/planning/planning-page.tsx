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
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";

import { AgendaTab } from "@/features/planning/agenda-tab";
import type {
  PlanningSearch,
  PlanningTab,
} from "@/features/planning/planning-search";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { HeaderProgress } from "@/ui/header-progress";
import { RefreshButton } from "@/ui/refresh-button";
import { useRefresh } from "@/ui/use-refresh";

const tabs: readonly { tab: PlanningTab; label: MessageKey }[] = [
  { tab: "agenda", label: "planning.tab.agenda" },
];

function withTab(prev: PlanningSearch, tab: PlanningTab): PlanningSearch {
  const next = { ...prev };
  delete next.tab;
  return tab === "agenda" ? next : { ...next, tab };
}

// What the schedules expect, one tab per view: the agenda of a month, the schedules, the
// subscriptions.
export function PlanningPage() {
  const t = useT();
  const today = useToday();
  const search = useSearch({ from: "/_authed/planning" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const month = search.month ?? today.slice(0, 7);
  const current: PlanningTab = search.tab ?? "agenda";
  // CP-09: the strip moves at once; the tab's region renders from the deferred value.
  const [chosen, setChosen] = useState<PlanningTab | null>(null);
  const shownTab = useDeferredValue(chosen ?? current);
  const refresh = useRefresh(() =>
    queryClient.invalidateQueries({ queryKey: ["planning"] }),
  );
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.planning")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("planning.subtitle")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <RefreshButton
                label={t("planning.refresh")}
                refreshing={refresh.refreshing}
                onRefresh={refresh.refresh}
              />
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
        <PageHeaderTabs>
          <Tabs
            value={chosen ?? current}
            onValueChange={(value) => {
              const entry = tabs.find((e) => e.tab === value);
              if (entry === undefined) return;
              setChosen(entry.tab);
              void navigate({
                to: "/planning",
                search: withTab(search, entry.tab),
                replace: true,
              }).then(() => {
                setChosen(null);
              });
            }}
          >
            <TabList aria-label={t("planning.tabs")}>
              {tabs.map((entry) => (
                <Tab key={entry.tab} value={entry.tab}>
                  {t(entry.label)}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </PageHeaderTabs>
        <HeaderProgress
          loading={refresh.refreshing || shownTab !== (chosen ?? current)}
          {...(refresh.refreshing ? { delay: 0 } : {})}
        />
      </PageHeader>
      <PageBody>
        <div aria-busy={shownTab !== (chosen ?? current) || undefined}>
          {shownTab === "agenda" && (
            <AgendaTab
              month={month}
              onMonth={(next) => {
                void navigate({
                  to: "/planning",
                  search: { ...search, month: next },
                  replace: true,
                });
              }}
            />
          )}
        </div>
      </PageBody>
    </Page>
  );
}
