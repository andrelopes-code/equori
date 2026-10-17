import { expect, test } from "vitest";

import { newClient } from "@/api/client";
import { fakeApi, json, problem } from "@/testing/fake-api";

test("serves a registered route, ignoring the query string", async () => {
  const fetchImpl = fakeApi({
    "GET /api/v1/accounts": () => json(200, { items: [] }),
  });
  const res = await newClient("https://equori.test", fetchImpl).GET(
    "/accounts",
  );
  expect(res.response.status).toBe(200);
  expect(res.data).toEqual({ items: [] });
  expect(fetchImpl.calls).toEqual([]);
});

test("answers an unknown route with a 404 not_found problem and records it", async () => {
  const fetchImpl = fakeApi({});
  const res = await newClient("https://equori.test", fetchImpl).GET(
    "/accounts",
  );
  expect(res.response.status).toBe(404);
  expect(res.error).toMatchObject({ status: 404, code: "not_found" });
  expect(fetchImpl.calls).toEqual(["GET /api/v1/accounts"]);
});

test("problem() builds an application/problem+json response", async () => {
  const res = problem(409, "version_conflict", { detail: "stale" });
  expect(res.status).toBe(409);
  expect(res.headers.get("Content-Type")).toBe("application/problem+json");
  expect(await res.json()).toEqual({
    type: "about:blank",
    title: "Conflict",
    status: 409,
    detail: "stale",
    code: "version_conflict",
  });
});
