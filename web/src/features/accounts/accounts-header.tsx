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
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import styles from "@/features/accounts/accounts-header.module.css";
import { connectionsListQuery } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { HeaderProgress } from "@/ui/header-progress";

export type AccountsTab = "accounts" | "institutions" | "links";

const routes = {
  accounts: "/accounts",
  institutions: "/accounts/institutions",
  links: "/accounts/links",
} as const;

function isTab(value: unknown): value is AccountsTab {
  return value === "accounts" || value === "institutions" || value === "links";
}

// The destination's header, shared by its three pages: each page writes its subheading and its
// actions into the two slots (HeaderSlot), and the tabs move between the pages.
export function AccountsHeader({
  current,
  subheadingRef,
  actionsRef,
  refreshing,
}: {
  current: AccountsTab;
  subheadingRef: (element: HTMLElement | null) => void;
  actionsRef: (element: HTMLElement | null) => void;
  // A refresh the reader asked for paints the bar at once.
  refreshing: boolean;
}) {
  const t = useT();
  const navigate = useNavigate();
  const connections = useQuery(connectionsListQuery(useApi()));
  const pending = (connections.data?.items ?? []).reduce(
    (sum, c) => sum + c.accounts.filter((a) => a.state === "pending").length,
    0,
  );
  // CP-09: the strip moves at once; the next tab's page mounts after that frame is painted.
  const [chosen, setChosen] = useState<AccountsTab | null>(null);
  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{t("nav.accounts")}</PageHeaderHeading>
            <PageHeaderSubheading>
              <span ref={subheadingRef} className={styles.slot} />
            </PageHeaderSubheading>
          </PageHeaderTitle>
          <PageHeaderActions>
            <span ref={actionsRef} className={styles.slot} />
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
      <PageHeaderTabs>
        <Tabs
          value={chosen ?? current}
          onValueChange={(value) => {
            if (!isTab(value)) return;
            setChosen(value);
            requestAnimationFrame(() => {
              setTimeout(() => {
                void navigate({ to: routes[value] }).then(() => {
                  setChosen(null);
                });
              }, 0);
            });
          }}
        >
          <TabList aria-label={t("nav.accounts")}>
            <Tab value="accounts">{t("accounts.tab.accounts")}</Tab>
            <Tab value="institutions">{t("accounts.tab.institutions")}</Tab>
            <Tab value="links">
              {pending > 0
                ? t("accounts.tab.linksPending", { count: pending })
                : t("accounts.tab.links")}
            </Tab>
          </TabList>
        </Tabs>
      </PageHeaderTabs>
      {/* Workaround for Slotted finding "PageHeaderProgress before PageHeaderTabs draws between
          the title and the tabs": it stands after the tabs, on the header's closing line. */}
      <HeaderProgress loading={refreshing} delay={0} />
    </PageHeader>
  );
}
