import { useRouter } from "@tanstack/react-router";

import type { ReportsSearch } from "@/features/reports/reports-search";
import { useAppLink } from "@/ui/use-app-link";

// The href and the click of a link to the reports with another address: a modified click opens
// the href, a plain click navigates inside the application.
export function useReportLink() {
  const router = useRouter();
  const follow = useAppLink();
  return (search: ReportsSearch) => {
    const clean = Object.fromEntries(
      Object.entries(search).filter(([, value]) => value !== undefined),
    );
    return {
      href: router.buildLocation({ to: "/reports", search: clean }).href,
      onClick: follow({ to: "/reports", search: clean }),
    };
  };
}
