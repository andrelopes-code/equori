import { describe, expect, it } from "vitest";

import { attentionItems } from "@/features/overview/attention";

const account = (id: string) => ({ id, name: id }) as never;
const money = (amount: number) => ({ amount, currency: "BRL" });

describe("attentionItems", () => {
  it("counts each kind and leaves out the ones with nothing to do", () => {
    const items = attentionItems({
      uncategorized: 3,
      unconfirmed: [
        { account: account("a"), count: 2 },
        { account: account("b"), count: 0 },
      ],
      connections: [
        { state: "ok" },
        { state: "failed" },
        { state: "needs_owner" },
      ],
      differences: [
        { account: account("a"), difference: money(-1500) },
        { account: account("b"), difference: undefined },
      ],
    });
    // A133: an account with a difference carries its unconfirmed count on that one row.
    expect(items.map((i) => [i.kind, i.count, i.account?.id])).toEqual([
      ["uncategorized", 3, undefined],
      ["connections", 2, undefined],
      ["difference", 1, "a"],
    ]);
    expect(items[2]?.unconfirmed).toBe(2);
  });

  it("keeps the statement of an account's earliest unconfirmed entry", () => {
    const items = attentionItems({
      uncategorized: 0,
      unconfirmed: [{ account: account("b"), count: 1, statementId: "s1" }],
      connections: [],
      differences: [{ account: account("b"), difference: undefined }],
    });
    expect(items).toEqual([
      {
        kind: "unconfirmed",
        count: 1,
        account: account("b"),
        statementId: "s1",
      },
    ]);
  });

  it("ignores an open assertion whose difference is zero", () => {
    expect(
      attentionItems({
        uncategorized: 0,
        unconfirmed: [],
        connections: [],
        differences: [{ account: account("a"), difference: money(0) }],
      }),
    ).toEqual([]);
  });

  it("is empty when nothing needs attention", () => {
    expect(
      attentionItems({
        uncategorized: 0,
        unconfirmed: [],
        connections: [{ state: "ok" }],
        differences: [],
      }),
    ).toEqual([]);
  });
});
