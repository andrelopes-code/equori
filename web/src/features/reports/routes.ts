import { lazyRouteComponent } from "@tanstack/react-router";

export { validateReportsSearch } from "@/features/reports/model/reports-search";

export const ReportsPage = lazyRouteComponent(
  () => import("@/features/reports/pages/reports-page"),
  "ReportsPage",
);
