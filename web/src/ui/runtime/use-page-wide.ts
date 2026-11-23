import { usePageSizeClass } from "@slotted/react/page";

// Whether the page has the desktop size class, read from the page's own width: a pane beside the
// page (the assistant) leaves it a tablet's width on a desktop viewport, so a layout chosen by the
// viewport alone overflows the page.
export function usePageWide(): boolean {
  return usePageSizeClass() === "expanded";
}
