import { PageHeaderTabs } from "@slotted/react/page-header";
import { Tab, TabList, Tabs } from "@slotted/react/tabs";

import { phoneCardTabs } from "@/features/cards/card-search";
import type { CardTab } from "@/features/cards/card-search";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

interface CardHeaderTabsProps {
  tab: CardTab;
  onTab: (tab: CardTab) => void;
}

export function CardHeaderTabs({ tab, onTab }: CardHeaderTabsProps) {
  const t = useT();
  const compact = useMediaQuery(compactQuery);

  const every: { tab: CardTab; label: string }[] = [
    { tab: "statements", label: t("card.tab.statements") },
    { tab: "plans", label: t("card.tab.plans") },
    { tab: "cards", label: t("card.tab.cards") },
    { tab: "settings", label: t("card.tab.settings") },
  ];
  const tabs = compact
    ? every.filter((entry) => phoneCardTabs.includes(entry.tab))
    : every;

  return (
    <PageHeaderTabs>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const entry = tabs.find((e) => e.tab === value);
          if (entry !== undefined) onTab(entry.tab);
        }}
      >
        <TabList aria-label={t("card.tabs")}>
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
