import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { buildAccountTree } from "@/features/accounts/account-tree";

type Account = components["schemas"]["Account"];

function account(id: string, over: Partial<Account> = {}): Account {
  return {
    id,
    name: id,
    class: "asset",
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
    ...over,
  };
}

describe("buildAccountTree", () => {
  it("nests three levels and sorts children by name", () => {
    const tree = buildAccountTree([
      account("c", { parent_id: "b" }),
      account("b", { parent_id: "a", name: "Beta" }),
      account("a", { name: "Alfa" }),
      account("b2", { parent_id: "a", name: "Aaa" }),
    ]);
    expect(tree).toHaveLength(1);
    const [group] = tree;
    expect(group?.class).toBe("asset");
    expect(group?.roots.map((n) => n.account.id)).toEqual(["a"]);
    const children = group?.roots[0]?.children ?? [];
    expect(children.map((n) => n.account.id)).toEqual(["b2", "b"]);
    expect(children[1]?.children.map((n) => n.account.id)).toEqual(["c"]);
  });

  it("makes an account whose parent is missing a root", () => {
    const tree = buildAccountTree([
      account("x", { parent_id: "gone", name: "Zed" }),
      account("y", { name: "Root" }),
    ]);
    expect(tree[0]?.roots.map((n) => n.account.id)).toEqual(["y", "x"]);
  });

  it("orders classes asset, liability, equity, income, expense and omits empty ones", () => {
    const tree = buildAccountTree([
      account("e", { class: "expense" }),
      account("i", { class: "income" }),
      account("q", { class: "equity" }),
      account("l", { class: "liability" }),
      account("a", { class: "asset" }),
    ]);
    expect(tree.map((g) => g.class)).toEqual([
      "asset",
      "liability",
      "equity",
      "income",
      "expense",
    ]);
    expect(buildAccountTree([account("a")]).map((g) => g.class)).toEqual([
      "asset",
    ]);
  });
});
