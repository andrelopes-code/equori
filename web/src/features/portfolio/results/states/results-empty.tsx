import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { PortfolioEmpty } from "@/features/portfolio/notices/portfolio-empty";

// PR11: a portfolio with no history; the action is a buy, or a brokerage when the book has none.
export function ResultsEmpty() {
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));

  const hasBrokerage = (accounts.data ?? []).some(
    (a) => a.kind === "brokerage" && a.parent_id === undefined,
  );

  return <PortfolioEmpty hasBrokerage={hasBrokerage} />;
}
