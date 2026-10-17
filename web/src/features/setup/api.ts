import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";

export const setupKeys = {
  settings: ["setup", "settings"] as const,
  instruments: ["setup", "instruments"] as const,
  payees: ["setup", "payees"] as const,
};

export function settingsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: setupKeys.settings,
    queryFn: async () => unwrap(await api.GET("/settings")),
  });
}

// An instrument scale never changes, so the list is cached for the session.
export function instrumentsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: setupKeys.instruments,
    queryFn: async () => unwrap(await api.GET("/instruments")),
    staleTime: Infinity,
  });
}

const pageLimit = 200;

// The picker and the row labels need every payee, so the query follows the cursor to the last page.
export function payeesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: setupKeys.payees,
    queryFn: async () => {
      const items = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/payees", {
            params: {
              query: {
                limit: pageLimit,
                ...(cursor === undefined ? {} : { cursor }),
              },
            },
          }),
        );
        items.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor !== undefined);
      return items;
    },
  });
}
