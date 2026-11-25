import type { MessageKey } from "@/i18n/catalog.en";

export type PortfolioTab = "results" | "positions" | "year" | "contributions";

export const portfolioTabs: readonly {
  tab: PortfolioTab;
  to: string;
  label: MessageKey;
}[] = [
  { tab: "results", to: "/portfolio", label: "portfolio.tabs.results" },
  {
    tab: "positions",
    to: "/portfolio/positions",
    label: "portfolio.tabs.positions",
  },
  { tab: "year", to: "/portfolio/year", label: "portfolio.tabs.year" },
  {
    tab: "contributions",
    to: "/portfolio/contribution-plan",
    label: "portfolio.tabs.contributions",
  },
];
