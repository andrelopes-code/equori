import { lazyRouteComponent } from "@tanstack/react-router";

export { isHelpPage } from "@/features/help/model/help-pages";

export const HelpIndexPage = lazyRouteComponent(
  () => import("@/features/help/pages/help-index-page"),
  "HelpIndexPage",
);

export const HelpPage = lazyRouteComponent(
  () => import("@/features/help/pages/help-page"),
  "HelpPage",
);
