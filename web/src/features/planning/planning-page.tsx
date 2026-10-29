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
import type { ReactNode } from "react";

import { HelpLink } from "@/features/help";
import { AgendaTab } from "@/features/planning/agenda-tab";
import { BudgetsArea } from "@/features/planning/budgets-area";
import { PlanningFooter } from "@/features/planning/planning-footer";
import { SchedulesTab } from "@/features/planning/schedules-tab";
import { SubscriptionsTab } from "@/features/planning/subscriptions-tab";
import type {
  PlanningSearch,
  PlanningTab,
} from "@/features/planning/planning-search";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { HeaderAction } from "@/ui/header-action";
import { HeaderProgress } from "@/ui/header-progress";
import { MonthControl } from "@/ui/month-control";
import { RefreshButton } from "@/ui/refresh-button";
import { useRefresh } from "@/ui/use-refresh";

const tabs: readonly { tab: PlanningTab; label: MessageKey }[] = [
  { tab: "agenda", label: "planning.tab.agenda" },
  { tab: "schedules", label: "planning.tab.schedules" },
  { tab: "subscriptions", label: "planning.tab.subscriptions" },
  { tab: "budgets", label: "planning.tab.budgets" },
];

function withTab(prev: PlanningSearch, tab: PlanningTab): PlanningSearch {
  const next = { ...prev };
  delete next.tab;
  return tab === "agenda" ? next : { ...next, tab };
}

// What the schedules expect and what the budgets allow, one tab per view: the agenda of a
// month, the schedules, the subscriptions, the budgets of a month.
export function PlanningPage() {
  const t = useT();
  const today = useToday();
  const search = useSearch({ from: "/_authed/planning" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const month = search.month ?? today.slice(0, 7);
  const current: PlanningTab = search.tab ?? "agenda";
  // CP-09: the strip moves at once; the tab's region renders from the address, deferred, so a
  // navigation the budget plan blocks over unsaved changes leaves the tab mounted.
  const [chosen, setChosen] = useState<PlanningTab | null>(null);
  const shownTab = useDeferredValue(current);
  const [footer, setFooter] = useState<ReactNode>(null);
  const create = () => {
    void navigate({ to: "/planning/schedules/new" });
  };
  const createBudget = () => {
    void navigate({ to: "/planning/budgets/new" });
  };
  const changeMonth = (next: string) => {
    void navigate({
      to: "/planning",
      search: { ...search, month: next },
      replace: true,
    });
  };
  const refresh = useRefresh(() =>
    queryClient.invalidateQueries({ queryKey: ["planning"] }),
  );
  return (
    <Page width="full" footer={footer ?? undefined}>
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
              {(current === "agenda" || current === "budgets") && (
                <MonthControl
                  label={t("agenda.month")}
                  value={month}
                  onChange={changeMonth}
                />
              )}
              {current === "budgets" && <HelpLink page="budget-plan" />}
              <RefreshButton
                label={t("planning.refresh")}
                refreshing={refresh.refreshing}
                onRefresh={refresh.refresh}
              />
              <HeaderAction
                primary
                label={t(current === "budgets" ? "budget.new" : "planning.new")}
                glyph="plus"
                onClick={current === "budgets" ? createBudget : create}
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
              }).finally(() => {
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
        <PlanningFooter.Provider value={setFooter}>
          <div aria-busy={shownTab !== (chosen ?? current) || undefined}>
            {shownTab === "agenda" && (
              <AgendaTab month={month} onMonth={changeMonth} />
            )}
            {shownTab === "schedules" && <SchedulesTab onCreate={create} />}
            {shownTab === "subscriptions" && <SubscriptionsTab />}
            {shownTab === "budgets" && (
              <BudgetsArea
                month={month}
                view={search.view}
                onView={(view) =>
                  navigate({
                    to: "/planning",
                    search: { ...search, view },
                    replace: true,
                  })
                }
                onCreate={createBudget}
                onStay={() => {
                  setChosen(null);
                }}
              />
            )}
          </div>
        </PlanningFooter.Provider>
      </PageBody>
    </Page>
  );
}
