import { describe, expect, it, vi } from "vitest";

import { ProblemError, parseProblem } from "@/api/problem";
import { newQueryClient } from "@/api/query-client";

function failWith(error: Error) {
  const queryFn = vi.fn<() => Promise<never>>(() => Promise.reject(error));
  return queryFn;
}

async function run(queryFn: () => Promise<never>, onUnauthenticated = vi.fn()) {
  const client = newQueryClient(onUnauthenticated);
  await client
    .query({ queryKey: ["probe"], queryFn, retryDelay: 0 })
    .catch(() => undefined);
  return onUnauthenticated;
}

function problemError(status: number, code: string) {
  return new ProblemError(
    parseProblem(status, { type: "about:blank", title: "x", status, code }),
  );
}

describe("newQueryClient", () => {
  it("does not retry a 4xx problem", async () => {
    const queryFn = failWith(problemError(404, "not_found"));
    await run(queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx problem twice", async () => {
    const queryFn = failWith(problemError(503, "server_busy"));
    await run(queryFn);
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it("retries a network error twice", async () => {
    const queryFn = failWith(new TypeError("Failed to fetch"));
    await run(queryFn);
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it("calls onUnauthenticated once for a 401 query", async () => {
    const queryFn = failWith(problemError(401, "unauthenticated"));
    const onUnauthenticated = await run(queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("calls onUnauthenticated once for a 401 mutation", async () => {
    const onUnauthenticated = vi.fn();
    const client = newQueryClient(onUnauthenticated);
    await client
      .getMutationCache()
      .build(client, {
        mutationFn: () => Promise.reject(problemError(401, "unauthenticated")),
      })
      .execute(undefined)
      .catch(() => undefined);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("does not call onUnauthenticated for other statuses", async () => {
    const onUnauthenticated = await run(
      failWith(problemError(403, "forbidden")),
    );
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });
});
