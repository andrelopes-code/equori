import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import type { paths } from "@/api/schema.gen";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface CallResult {
  status: number;
  body: unknown;
}

// The admin page reaches every operation by a path built at run time, which the typed
// client cannot name; the casts hand it a path and an init it does not check.
export async function callApi(
  api: Client<paths>,
  method: Method,
  path: string,
  query: Readonly<Record<string, string>> = {},
  body?: unknown,
): Promise<CallResult> {
  const params = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== ""),
  );
  const init = {
    params: { query: params },
    ...(body === undefined ? {} : { body }),
  };
  const result = await api.request(
    method.toLowerCase() as never,
    path as never,
    init as never,
  );
  const data: unknown = result.data;
  const error: unknown = result.error;
  return { status: result.response.status, body: data ?? error };
}

export class CallError extends Error {
  readonly result: CallResult;

  constructor(result: CallResult) {
    super(`HTTP ${String(result.status)}`);
    this.name = "CallError";
    this.result = result;
  }
}

export const adminKeys = {
  all: ["admin"] as const,
};

export function adminQuery(
  api: Client<paths>,
  path: string,
  query: Readonly<Record<string, string>> = {},
) {
  return queryOptions({
    queryKey: [...adminKeys.all, path, query] as const,
    queryFn: async () => {
      const result = await callApi(api, "GET", path, query);
      if (result.status >= 400) throw new CallError(result);
      return result.body;
    },
  });
}

// Follows next_cursor until the list ends, for sums that must count every record.
export function allPagesQuery(
  api: Client<paths>,
  path: string,
  query: Readonly<Record<string, string>> = {},
) {
  return queryOptions({
    queryKey: [...adminKeys.all, "all", path, query] as const,
    queryFn: async () => {
      const items: unknown[] = [];
      let cursor = "";
      do {
        const result = await callApi(api, "GET", path, {
          ...query,
          limit: "200",
          cursor,
        });
        if (result.status >= 400) throw new CallError(result);
        const page = result.body as { items: unknown[]; next_cursor?: string };
        items.push(...page.items);
        cursor = page.next_cursor ?? "";
      } while (cursor !== "");
      return items;
    },
  });
}
