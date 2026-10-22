import { useQueries } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { commitmentQuery } from "@/features/cards/api";
import { addMonths } from "@/features/cards/reference-months";

export const committedMonths = 12;

// The installments not yet billed on each of the twelve statements after the open one.
export function useCommitments(accountId: string, after: string) {
  const api = useApi();
  const months = Array.from({ length: committedMonths }, (_, i) =>
    addMonths(after, i + 1),
  );
  const results = useQueries({
    queries: months.map((month) => commitmentQuery(api, accountId, month)),
  });
  return {
    months: months.map((month, i) => ({
      month,
      amount: results[i]?.data?.amount,
    })),
    pending: results.some((r) => r.isPending),
  };
}
