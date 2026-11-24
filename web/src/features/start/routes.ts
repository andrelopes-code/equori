import { lazyRouteComponent } from "@tanstack/react-router";

export const StartPage = lazyRouteComponent(
  () => import("@/features/start/start-page"),
  "StartPage",
);
