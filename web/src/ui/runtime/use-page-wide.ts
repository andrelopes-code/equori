import { createContext, useContext } from "react";

import { useMediaQuery, wideQuery } from "@/ui/runtime/use-media-query";

// Whether the page region of the shell is at least 1024 px wide. The shell provides it; a page
// drawn outside a shell, where nothing measures the region, takes the viewport's answer.
export const PageRegionWide = createContext(true);

// Whether the page has the desktop size class: a desktop viewport and a page region that keeps
// 1024 px. A pane beside the page (the assistant) leaves it a tablet's width on a desktop
// viewport, so a layout chosen by the viewport alone overflows the region.
// Workaround for Slotted issue #136: the package exports no hook for the page's size class, so
// the shell measures its page region and provides the answer.
export function usePageWide(): boolean {
  const viewportWide = useMediaQuery(wideQuery);
  const regionWide = useContext(PageRegionWide);

  return viewportWide && regionWide;
}
