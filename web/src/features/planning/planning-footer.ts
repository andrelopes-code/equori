import { createContext } from "react";
import type { ReactNode } from "react";

// The footer of the planning page, which a tab deep in its body sets: a PageFooter while the
// tab has actions there, null otherwise. The page owns the Page, so the tab hands it the
// element instead of rendering it in place.
export const PlanningFooter = createContext<(footer: ReactNode) => void>(
  () => undefined,
);
