import { lazyRouteComponent } from "@tanstack/react-router";

export { validatePortfolioSearch } from "@/features/portfolio/model/portfolio-search";
export { validateResultsSearch } from "@/features/portfolio/results/results-search";
export { validateYearSearch } from "@/features/portfolio/pages/year-search";

export const ContributionPlanPage = lazyRouteComponent(
  () => import("@/features/portfolio/pages/contribution-plan-page"),
  "ContributionPlanPage",
);

export const PortfolioPositionsPage = lazyRouteComponent(
  () => import("@/features/portfolio/pages/portfolio-positions-page"),
  "PortfolioPositionsPage",
);

export const PortfolioResultsPage = lazyRouteComponent(
  () => import("@/features/portfolio/pages/portfolio-results-page"),
  "PortfolioResultsPage",
);

export const PortfolioYearPage = lazyRouteComponent(
  () => import("@/features/portfolio/pages/portfolio-year-page"),
  "PortfolioYearPage",
);
