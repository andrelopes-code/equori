import { useState } from "react";

import {
  readCollapsed,
  writeCollapsed,
} from "@/features/planning/budget-plan/plan-collapsed";
import { useMediaQuery } from "@/ui/runtime/use-media-query";

// The collapsed groups of the plan table, kept per browser, and the scroll to a group that a
// segment of the bar selects (budget plan spec 5.2).
export function usePlanGroupsOpen() {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = (group: string) => {
    const next = new Set(collapsed);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setCollapsed(next);
    writeCollapsed(next);
  };

  const select = (group: string) => {
    if (collapsed.has(group)) toggle(group);
    document.getElementById(`plan-group-${group}`)?.scrollIntoView({
      block: "center",
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return { collapsed, toggle, select };
}
