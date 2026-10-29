import { useRouter } from "@tanstack/react-router";
import type { NavigateOptions } from "@tanstack/react-router";

import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// Whether a destination renders its page at the current width (ADR 027, S2 and S5): below 600 px
// only a route with staticData.phone does, and only on a tab its staticData.phoneTabs names.
// A link or an action to a destination that does not render is left out.
export function useServed(): (options: NavigateOptions) => boolean {
  const router = useRouter();
  const compact = useMediaQuery(compactQuery);

  return (options) => {
    if (!compact) return true;

    const location = router.buildLocation(options);
    const leaf = router.matchRoutes(location.pathname).at(-1);
    if (leaf?.staticData.phone !== true) return false;

    const tab = (location.search as { tab?: unknown }).tab;
    const tabs = leaf.staticData.phoneTabs;

    return typeof tab !== "string" || tabs === undefined || tabs.includes(tab);
  };
}
