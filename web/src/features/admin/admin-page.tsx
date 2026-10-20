import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTabs,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Tab, TabList, Tabs } from "@slotted/react/tabs";
import { useDeferredValue, useState } from "react";

import { AccountsPanel } from "@/features/admin/accounts-panel";
import { CardsPanel } from "@/features/admin/cards-panel";
import { CategorizationPanel } from "@/features/admin/categorization-panel";
import { GroupPanel } from "@/features/admin/group-panel";
import { OverviewPanel } from "@/features/admin/overview-panel";
import { SchedulesPanel } from "@/features/admin/schedules-panel";
import { TransactionsPanel } from "@/features/admin/transactions-panel";
import { useAdminContext } from "@/features/admin/use-admin-context";
import type { AdminContext } from "@/features/admin/use-admin-context";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

type TabKey =
  | "overview"
  | "accounts"
  | "transactions"
  | "cards"
  | "schedules"
  | "categorization"
  | "planning"
  | "registry"
  | "more";

const tabLabels: Record<TabKey, MessageKey> = {
  overview: "admin.tab.overview",
  accounts: "admin.tab.accounts",
  transactions: "admin.tab.transactions",
  cards: "admin.tab.cards",
  schedules: "admin.tab.schedules",
  categorization: "admin.tab.categorization",
  planning: "admin.tab.planning",
  registry: "admin.tab.registry",
  more: "admin.tab.more",
};

const tabs = Object.keys(tabLabels) as TabKey[];

function isTab(value: string): value is TabKey {
  return value in tabLabels;
}

const panelID = "admin-panel";

// Only the selected tab's panel is mounted: each one holds tables and forms over every record.
function panel(tab: TabKey, ctx: AdminContext) {
  switch (tab) {
    case "overview":
      return <OverviewPanel ctx={ctx} />;
    case "accounts":
      return <AccountsPanel ctx={ctx} />;
    case "transactions":
      return <TransactionsPanel ctx={ctx} />;
    case "cards":
      return <CardsPanel ctx={ctx} />;
    case "schedules":
      return <SchedulesPanel ctx={ctx} />;
    case "categorization":
      return <CategorizationPanel ctx={ctx} />;
    case "planning":
      return (
        <GroupPanel
          ctx={ctx}
          lists={[{ path: "/budgets" }, { path: "/goals" }]}
          groups={["planning"]}
        />
      );
    case "registry":
      return (
        <GroupPanel
          ctx={ctx}
          lists={[
            { path: "/settings", query: {} },
            { path: "/institutions" },
            { path: "/payees" },
            { path: "/tags" },
            { path: "/instruments", query: {} },
          ]}
          groups={["registry"]}
        />
      );
    case "more":
      return (
        <GroupPanel
          ctx={ctx}
          lists={[{ path: "/import-batches" }, { path: "/connections" }]}
          groups={["reconciliation", "ingestion", "investments"]}
        />
      );
  }
}

// Temporary: a console over every API operation to check the backend while the screens are rebuilt.
export function AdminPage() {
  const t = useT();
  const ctx = useAdminContext();
  const [tab, setTab] = useState<TabKey>("overview");
  // The selected tab paints in the click's frame; the panel, which mounts tables and forms,
  // renders from the deferred value in an interruptible pass after it.
  const shown = useDeferredValue(tab);
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.admin")}</PageHeaderHeading>
              <PageHeaderSubheading>{t("admin.subtitle")}</PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
        <PageHeaderTabs>
          <Tabs
            value={tab}
            onValueChange={(next) => {
              if (isTab(next)) setTab(next);
            }}
          >
            <TabList aria-label={t("nav.admin")}>
              {tabs.map((key) => (
                <Tab key={key} value={key} controls={panelID}>
                  {t(tabLabels[key])}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </PageHeaderTabs>
      </PageHeader>
      <PageBody id={panelID} aria-busy={shown !== tab}>
        {panel(shown, ctx)}
      </PageBody>
    </Page>
  );
}
