import createClient, { type Client } from "openapi-fetch";

import type { paths } from "./schema.gen";

// The session cookie (ADR 003) travels only with same-origin credentials; the client holds no token.
export function newClient(
  origin: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Client<paths> {
  return createClient<paths>({
    baseUrl: `${origin}/api/v1`,
    credentials: "same-origin",
    fetch: fetchImpl,
  });
}
