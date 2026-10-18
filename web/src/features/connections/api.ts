import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";

export const connectionKeys = {
  list: ["connections", "list"] as const,
};

// One page holds every connection of a household; the sync status reads only this page.
const listLimit = 100;

export function connectionsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: connectionKeys.list,
    queryFn: async () =>
      unwrap(
        await api.GET("/connections", {
          params: { query: { limit: listLimit } },
        }),
      ),
  });
}
