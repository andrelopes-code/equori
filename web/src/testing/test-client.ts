import type { Client } from "openapi-fetch";

import { newClient } from "@/api/client";
import type { paths } from "@/api/schema.gen";

// The application's client over a fake fetch, for tests of a feature's requests.
export function testClient(
  origin: string,
  fetchImpl: typeof fetch,
): Client<paths> {
  return newClient(origin, fetchImpl);
}
