import { PageHeaderTabs } from "@slotted/react/page-header";
import { Tab, TabList, Tabs } from "@slotted/react/tabs";

import type { TabEntry } from "@/features/accounts/account-header";
import type { AccountTab } from "@/features/accounts/account-search";
import { useT } from "@/i18n/i18n-provider";

interface AccountHeaderTabsProps {
  tabs: TabEntry[];
  current: AccountTab;
  onTab: (tab: AccountTab) => void;
}

// A strip of one tab switches nothing; the phone offers only the activity (ADR 027, S5).
export function AccountHeaderTabs({
  tabs,
  current,
  onTab,
}: AccountHeaderTabsProps) {
  const t = useT();

  if (tabs.length < 2) return null;

  return (
    <PageHeaderTabs>
      <Tabs
        value={current}
        onValueChange={(value) => {
          const entry = tabs.find((e) => e.tab === value);
          if (entry !== undefined) onTab(entry.tab);
        }}
      >
        <TabList aria-label={t("account.tabs")}>
          {tabs.map((entry) => (
            <Tab key={entry.tab} value={entry.tab}>
              {entry.label}
            </Tab>
          ))}
        </TabList>
      </Tabs>
    </PageHeaderTabs>
  );
}
