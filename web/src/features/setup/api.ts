import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";

export const setupKeys = {
  settings: ["setup", "settings"] as const,
  instruments: ["setup", "instruments"] as const,
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
