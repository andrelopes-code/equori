import type { ReportsSearch } from "@/features/reports/reports-search";
import { routeTo } from "@/ui/route-to";

// The render of a link to the reports with another address.
export function reportLink(search: ReportsSearch) {
  const clean = Object.fromEntries(
    Object.entries(search).filter(([, value]) => value !== undefined),
  );
  return { render: routeTo({ to: "/reports", search: clean }) };
}
