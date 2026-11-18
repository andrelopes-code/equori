import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { goalsQuery } from "@/features/planning";
import { reservedFor } from "@/features/portfolio/contribution-plan/model/reserved-for";

// The name of the goal that holds a member of the contribution plan; undefined when none does
// or while the goals load (CN20).
export function useReservedFor(member: {
  account_id?: string;
  instrument?: string;
}): string | undefined {
  const api = useApi();
  const goals = useQuery(goalsQuery(api));
  const accounts = useQuery(accountsQuery(api));

  if (goals.data === undefined || accounts.data === undefined) return undefined;

  return reservedFor(member, goals.data, accounts.data);
}
