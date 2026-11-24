import { lazyRouteComponent } from "@tanstack/react-router";

export const GoalsPage = lazyRouteComponent(
  () => import("@/features/goals/pages/goals-page"),
  "GoalsPage",
);
