// @vitest-environment node
// FormData and File must both be Node's; jsdom installs its own File, which Node's FormData refuses.
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  csvProfileQuery,
  importBatchesQuery,
  importFile,
} from "@/features/accounts/api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { testClient as newClient } from "@/testing/test-client";

const accountID = "11111111-1111-4111-8111-111111111111";
const otherID = "99999999-9999-4999-8999-999999999999";

function batch(id: string, account: string) {
  return {
    id,
    account_id: account,
    source: "ofx",
    counts: {
      received: 1,
      ignored: 0,
      matched: 0,
      created: 1,
      needs_review: 0,
      discarded: 0,
      updated: 0,
      withdrawn: 0,
    },
    balance: { status: "none" },
    started_at: "2026-10-01T12:00:00Z",
  };
}

describe("csvProfileQuery", () => {
  it("answers null when the account has no CSV profile", async () => {
    const api = newClient(
      "http://test",
      fakeApi({
        [`GET /api/v1/accounts/${accountID}/csv-profile`]: () =>
          problem(404, "not_found"),
      }),
    );
    await expect(
      new QueryClient().query(csvProfileQuery(api, accountID)),
    ).resolves.toBeNull();
  });
});

describe("importBatchesQuery", () => {
  it("reads the next page while the account has fewer than 50 batches", async () => {
    const cursors: (string | null)[] = [];
    const api = newClient(
      "http://test",
      fakeApi({
        "GET /api/v1/import-batches": (req) => {
          const cursor = new URL(req.url).searchParams.get("cursor");
          cursors.push(cursor);
          return cursor === null
            ? json(200, {
                items: [batch("b1", accountID), batch("b2", otherID)],
                next_cursor: "c2",
              })
            : json(200, { items: [batch("b3", accountID)] });
        },
      }),
    );
    const items = await new QueryClient().query(
      importBatchesQuery(api, accountID),
    );
    expect(cursors).toEqual([null, "c2"]);
    expect(items.map((b) => b.id)).toEqual(["b1", "b3"]);
  });
});

describe("importFile", () => {
  it("sends the file and its format as multipart form data", async () => {
    let contentType = "";
    let fields: [string, string][] = [];
    const api = newClient(
      "http://test",
      fakeApi({
        [`POST /api/v1/accounts/${accountID}/imports`]: async (req) => {
          contentType = req.headers.get("Content-Type") ?? "";
          const form = await req.formData();
          fields = [...form.entries()].map(([k, v]) => [
            k,
            typeof v === "string" ? v : v.name,
          ]);
          return json(201, batch("b9", accountID));
        },
      }),
    );
    const file = new File(["a;b\n"], "extrato.csv", { type: "text/csv" });
    const created = await importFile(api, {
      accountId: accountID,
      format: "csv",
      file,
    });
    expect(contentType).toMatch(/^multipart\/form-data/);
    expect(fields).toEqual([
      ["format", "csv"],
      ["file", "extrato.csv"],
    ]);
    expect(created.id).toBe("b9");
  });
});
