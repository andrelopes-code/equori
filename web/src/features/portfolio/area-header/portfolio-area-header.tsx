import { Divider } from "@slotted/react/divider";
import { Inline } from "@slotted/react/inline";
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
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { HelpLink } from "@/features/help";
import { portfolioTabs } from "@/features/portfolio/area-header/portfolio-tabs";
import type { PortfolioTab } from "@/features/portfolio/area-header/portfolio-tabs";
import { useT } from "@/i18n/i18n-provider";

interface PortfolioAreaHeaderProps {
  tab: PortfolioTab;
  subheading: ReactNode;
  // The value controls of the tab (currency, date, year, account); drawn before the rule.
  controls?: ReactNode;
  // The actions of the tab, lightest first; drawn after the help link.
  actions?: ReactNode;
  // The help page of the tab.
  help: string;
  // The valuation currency carried to the other tabs.
  valueIn?: string | undefined;
}

// PT1, PT3, PT4: one header on the five routes of the portfolio area. A tab is a link that carries
// the valuation currency; the controls come first, a rule, the help link, then the actions.
export function PortfolioAreaHeader({
  tab,
  subheading,
  controls,
  actions,
  help,
  valueIn,
}: PortfolioAreaHeaderProps) {
  const t = useT();
  const router = useRouter();
  const navigate = useNavigate();

  const search = valueIn === undefined ? {} : { value_in: valueIn };
  const hrefOf = (to: string) =>
    router.buildLocation({ to, search } as never).href;

  const handleValueChange = (value: string) => {
    const entry = portfolioTabs.find((e) => e.tab === value);
    if (entry !== undefined) void navigate({ to: entry.to, search } as never);
  };

  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{t("nav.portfolio")}</PageHeaderHeading>
            <PageHeaderSubheading>{subheading}</PageHeaderSubheading>
          </PageHeaderTitle>

          {/* A page header's controls carry no visible label; each names itself to assistive
              technology. */}
          <PageHeaderActions>
            <Inline gap={3} wrap="nowrap">
              {controls}
              {controls !== undefined && (
                <Divider orientation="vertical" className="mx-2" />
              )}
              <HelpLink page={help} />
              {actions}
            </Inline>
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>

      <PageHeaderTabs>
        <Tabs value={tab} onValueChange={handleValueChange}>
          <TabList aria-label={t("portfolio.tabs.label")}>
            {portfolioTabs.map((entry) => (
              <Tab key={entry.tab} value={entry.tab} href={hrefOf(entry.to)}>
                {t(entry.label)}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      </PageHeaderTabs>
    </PageHeader>
  );
}
