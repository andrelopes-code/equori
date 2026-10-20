import { setFilter } from "@slotted/core/filter";
import type { FilterGroup } from "@slotted/core/filter";
import { describe, expect, it } from "vitest";

import {
  searchFromTree,
  treeFromSearch,
} from "@/features/transactions/filter-tree";

const account = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const payee = "33333333-3333-4333-8333-333333333333";

function period(
  operator: "between" | "after" | "before",
  value: string | null,
  end: string | null = null,
): FilterGroup["rules"][number] {
  return {
    field: "period",
    filter: {
      kind: "date",
      join: "and",
      conditions: [{ operator, value, end }],
    },
  };
}

describe("treeFromSearch", () => {
  it("returns null for an unfiltered search", () => {
    expect(treeFromSearch({ q: "pão" })).toBeNull();
  });

  it("writes one rule per URL filter, in the bar's field order", () => {
    expect(
      treeFromSearch({
        account_id: account,
        payee_id: payee,
        tag: "viagem",
        from: "2026-10-01",
        to: "2026-10-31",
        uncategorized: true,
      }),
    ).toEqual({
      join: "and",
      rules: [
        { field: "account", filter: setFilter([account]) },
        period("between", "2026-10-01", "2026-10-31"),
        { field: "payee", filter: setFilter([payee]) },
        { field: "tag", filter: setFilter(["viagem"]) },
        {
          field: "uncategorized",
          filter: {
            kind: "boolean",
            join: "and",
            conditions: [{ operator: "is", value: true }],
          },
        },
      ],
    });
  });

  it("writes an open period with the operator of its one end", () => {
    expect(treeFromSearch({ from: "2026-10-01" })?.rules).toEqual([
      period("after", "2026-10-01"),
    ]);
    expect(treeFromSearch({ to: "2026-10-31" })?.rules).toEqual([
      period("before", "2026-10-31"),
    ]);
  });
});

describe("searchFromTree", () => {
  it("round-trips every URL filter and keeps the query", () => {
    const search = {
      account_id: account,
      payee_id: payee,
      tag: "viagem",
      from: "2026-10-01",
      to: "2026-10-31",
      uncategorized: true as const,
    };
    expect(
      searchFromTree(treeFromSearch(search), { ...search, q: "pão" }),
    ).toEqual({ ...search, q: "pão" });
  });

  it("removes every filter when the tree is null, keeping the query", () => {
    expect(searchFromTree(null, { account_id: account, q: "pão" })).toEqual({
      q: "pão",
    });
  });

  it("keeps the newly chosen value of a set field, since the URL holds one", () => {
    const tree: FilterGroup = {
      join: "and",
      rules: [{ field: "account", filter: setFilter([account, other]) }],
    };
    expect(searchFromTree(tree, { account_id: account })).toEqual({
      account_id: other,
    });
    expect(searchFromTree(tree, {})).toEqual({ account_id: account });
  });

  it("reads a period from each date operator", () => {
    const of = (rule: FilterGroup["rules"][number]) =>
      searchFromTree({ join: "and", rules: [rule] }, {});
    expect(of(period("between", "2026-10-01", "2026-10-31"))).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(of(period("after", "2026-10-01"))).toEqual({ from: "2026-10-01" });
    expect(of(period("before", "2026-10-31"))).toEqual({ to: "2026-10-31" });
  });

  it("drops an uncategorized rule that is not true", () => {
    expect(
      searchFromTree(
        {
          join: "and",
          rules: [
            {
              field: "uncategorized",
              filter: {
                kind: "boolean",
                join: "and",
                conditions: [{ operator: "is", value: false }],
              },
            },
          ],
        },
        {},
      ),
    ).toEqual({});
  });
});

describe("category filter", () => {
  const food = "55555555-5555-4555-8555-555555555555";
  const isCategory = (id: string) => id === food;

  it("writes a category rule when the account is a category", () => {
    expect(treeFromSearch({ account_id: food }, isCategory)).toEqual({
      join: "and",
      rules: [{ field: "category", filter: setFilter([food]) }],
    });
  });

  it("reads a category rule into account_id", () => {
    const tree: FilterGroup = {
      join: "and",
      rules: [{ field: "category", filter: setFilter([food]) }],
    };
    expect(searchFromTree(tree, {})).toEqual({ account_id: food });
  });

  it("lets a newly added category replace the account filter", () => {
    const tree: FilterGroup = {
      join: "and",
      rules: [
        { field: "account", filter: setFilter([account]) },
        { field: "category", filter: setFilter([food]) },
      ],
    };
    expect(searchFromTree(tree, { account_id: account })).toEqual({
      account_id: food,
    });
  });

  it("lets a newly added account replace the category filter", () => {
    const tree: FilterGroup = {
      join: "and",
      rules: [
        { field: "account", filter: setFilter([account]) },
        { field: "category", filter: setFilter([food]) },
      ],
    };
    expect(searchFromTree(tree, { account_id: food })).toEqual({
      account_id: account,
    });
  });
});
