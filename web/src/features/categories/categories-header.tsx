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
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";
import { HeaderProgress } from "@/ui/header-progress";

export type CategoriesTab = "categories" | "rules" | "payees";

const routes = {
  categories: "/categories",
  rules: "/categories/rules",
  payees: "/categories/payees",
} as const;

const subtitles = {
  categories: "categories.subtitle.categories",
  rules: "categories.subtitle.rules",
  payees: "categories.subtitle.payees",
} as const;

// The three pages of the destination share one header; each tab is its own route (LA-04).
export function CategoriesHeader({
  current,
  actions,
  rulesLabel,
  refreshing,
  requested = false,
}: {
  current: CategoriesTab;
  actions?: ReactNode;
  // The rules tab names the pending suggestions when there are any.
  rulesLabel?: string | undefined;
  // A page that reads again while its figures are on screen shows the wait on the header's bar.
  refreshing?: boolean | undefined;
  // A refresh the reader asked for paints the bar at once.
  requested?: boolean;
}) {
  const t = useT();
  const navigate = useNavigate();
  // CP-09: the strip moves at once; the next tab's page mounts after that frame is painted.
  // The router commits a navigation synchronously, so a transition alone would hold the strip
  // until the next page has rendered.
  const [chosen, setChosen] = useState<CategoriesTab | null>(null);
  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{t("nav.categories")}</PageHeaderHeading>
            <PageHeaderSubheading>{t(subtitles[current])}</PageHeaderSubheading>
          </PageHeaderTitle>
          {actions !== undefined && (
            <PageHeaderActions>{actions}</PageHeaderActions>
          )}
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
      <PageHeaderTabs>
        <Tabs
          value={chosen ?? current}
          onValueChange={(value) => {
            if (
              value === "categories" ||
              value === "rules" ||
              value === "payees"
            ) {
              setChosen(value);
              requestAnimationFrame(() => {
                setTimeout(() => {
                  void navigate({ to: routes[value] });
                }, 0);
              });
            }
          }}
        >
          <TabList aria-label={t("nav.categories")}>
            <Tab value="categories">{t("categories.tab.categories")}</Tab>
            <Tab value="rules">{rulesLabel ?? t("categories.tab.rules")}</Tab>
            <Tab value="payees">{t("categories.tab.payees")}</Tab>
          </TabList>
        </Tabs>
      </PageHeaderTabs>
      {refreshing !== undefined && (
        <HeaderProgress
          loading={refreshing}
          {...(requested ? { delay: 0 } : {})}
        />
      )}
    </PageHeader>
  );
}
