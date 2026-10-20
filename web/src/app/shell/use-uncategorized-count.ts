import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { uncategorizedCountQuery } from "@/features/transactions";

// The count shown beside Transactions; undefined at zero or while unknown.
export function useUncategorizedCount(): string | undefined {
  const { data } = useQuery(uncategorizedCountQuery(useApi()));
  if (data === undefined || data.count === 0) return undefined;
  return data.more ? `${String(data.count)}+` : String(data.count);
}
