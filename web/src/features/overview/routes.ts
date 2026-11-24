import { lazyRouteComponent } from "@tanstack/react-router";

export const OverviewPage = lazyRouteComponent(
  () => import("@/features/overview/pages/overview-page"),
  "OverviewPage",
);
