import { lazyRouteComponent } from "@tanstack/react-router";

export { validatePortfolioSearch } from "@/features/portfolio/model/portfolio-search";
export { validateYearSearch } from "@/features/portfolio/pages/year-search";

export const ContributionPlanPage = lazyRouteComponent(
  () => import("@/features/portfolio/pages/contribution-plan-page"),
  "ContributionPlanPage",
);

export const PortfolioPage = lazyRouteComponent(
  () => import("@/features/portfolio/pages/portfolio-page"),
  "PortfolioPage",
);

export const PortfolioYearPage = lazyRouteComponent(
  () => import("@/features/portfolio/pages/portfolio-year-page"),
  "PortfolioYearPage",
);
