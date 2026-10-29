import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { lineage } from "@/features/accounts/account-lineage";

type Account = components["schemas"]["Account"];

describe("lineage", () => {
  it("lists the parents up to the root and every account below, breadth first", () => {
    const self = account("self", "mid");
    const accounts = [
      account("root"),
      account("mid", "root"),
      self,
      account("child", "self"),
      account("other", "self"),
      account("grandchild", "child"),
      account("aside", "root"),
    ];

    const { ancestors, descendants } = lineage(self, accounts);

    expect(ancestors.map((a) => a.id)).toEqual(["mid", "root"]);
    expect(descendants.map((a) => a.id)).toEqual([
      "child",
      "other",
      "grandchild",
    ]);
  });

  it("stops at a parent missing from the list", () => {
    const self = account("self", "gone");

    const { ancestors, descendants } = lineage(self, [self]);

    expect(ancestors).toEqual([]);
    expect(descendants).toEqual([]);
  });
});

function account(id: string, parent?: string): Account {
  return {
    id,
    name: id,
    class: "asset",
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
    ...(parent === undefined ? {} : { parent_id: parent }),
  };
}
