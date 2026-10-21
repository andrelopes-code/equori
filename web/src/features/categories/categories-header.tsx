import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTabs,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Tab, TabList, Tabs } from "@slotted/react/tabs";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";

export type CategoriesTab = "categories" | "rules" | "payees";

const routes = {
  categories: "/categories",
  rules: "/categories/rules",
  payees: "/categories/payees",
} as const;

// The three pages of the destination share one header; each tab is its own route (LA-04).
export function CategoriesHeader({
  current,
  actions,
  rulesLabel,
}: {
  current: CategoriesTab;
  actions?: ReactNode;
  // The rules tab names the pending suggestions when there are any.
  rulesLabel?: string | undefined;
}) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{t("nav.categories")}</PageHeaderHeading>
          </PageHeaderTitle>
          {actions !== undefined && (
            <PageHeaderActions>{actions}</PageHeaderActions>
          )}
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
      <PageHeaderTabs>
        <Tabs
          value={current}
          onValueChange={(value) => {
            if (
              value === "categories" ||
              value === "rules" ||
              value === "payees"
            ) {
              void navigate({ to: routes[value] });
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
    </PageHeader>
  );
}
