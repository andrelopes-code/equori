import { expect, test } from "vitest";

import { newClient } from "@/api/client";

test("sends requests under /api/v1 of the origin with same-origin credentials", async () => {
  const requests: Request[] = [];
  const client = newClient("https://equori.test", (input) => {
    if (!(input instanceof Request)) {
      throw new TypeError("expected a Request");
    }
    requests.push(input);
    return Promise.resolve(
      new Response('{"items":[]}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  await client.GET("/accounts");

  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe("https://equori.test/api/v1/accounts");
  expect(requests[0]?.credentials).toBe("same-origin");
});
