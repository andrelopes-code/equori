import { lazyRouteComponent } from "@tanstack/react-router";

export { validateSettingsSearch } from "@/features/setup/model/settings-search";

export const AppearanceStudio = lazyRouteComponent(
  () => import("@/features/setup/pages/appearance-studio"),
  "AppearanceStudio",
);

export const SettingsPage = lazyRouteComponent(
  () => import("@/features/setup/pages/settings-page"),
  "SettingsPage",
);
