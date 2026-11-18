import { describe, expect, it } from "vitest";

import {
  destinationViews,
  matchView,
  viewHref,
} from "@/app/shell/destinations/destination-views";

describe("matchView", () => {
  it.each([
    ["/planning", {}, "planning.agenda"],
    ["/planning", { month: "2026-11" }, "planning.agenda"],
    ["/planning", { tab: "budgets", month: "2026-11" }, "planning.budgets"],
    ["/reports", { tab: "flows" }, "reports.flows"],
    ["/reports", {}, "reports.net-worth"],
    ["/transactions", {}, "transactions.all"],
    ["/transactions", { uncategorized: true }, "transactions.queue"],
    ["/categories/rules", {}, "categories.rules"],
    ["/accounts/links", {}, "accounts.links"],
  ])("matches %s %j to %s", (pathname, search, key) => {
    expect(matchView(pathname, search)?.key).toBe(key);
  });

  it.each([
    ["/transactions/abc", {}],
    ["/accounts/x", {}],
    ["/portfolio", {}],
    ["/", {}],
  ])("matches no view for %s", (pathname, search) => {
    expect(matchView(pathname, search)).toBeUndefined();
  });
});

describe("viewHref", () => {
  it("writes the search of a view after its route", () => {
    const hrefs = Object.values(destinationViews)
      .flat()
      .map((view) => viewHref(view));

    expect(hrefs).toContain("/planning");
    expect(hrefs).toContain("/planning?tab=budgets");
    expect(hrefs).toContain("/transactions?uncategorized=true");
    expect(hrefs).toContain("/categories/tags");
  });
});
