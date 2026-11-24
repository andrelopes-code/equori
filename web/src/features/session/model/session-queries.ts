import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem-error";
import type { paths } from "@/api/schema.gen";

export const sessionKeys = {
  me: ["session", "me"] as const,
  setup: ["session", "setup"] as const,
  books: ["session", "books"] as const,
};

export function meQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: sessionKeys.me,
    queryFn: async () => unwrap(await api.GET("/me")),
  });
}

// Whether the first user is still to be created (W-U2 of the Windows design).
export function setupQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: sessionKeys.setup,
    queryFn: async () => unwrap(await api.GET("/setup")),
  });
}

// GET /me/books, the items in books ID order.
export function myBooksQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: sessionKeys.books,
    queryFn: async () => {
      const { items } = await unwrap(await api.GET("/me/books"));
      return [...items].sort((a, b) => a.id - b.id);
    },
  });
}
