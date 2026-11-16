import { describe, expect, it } from "vitest";

import { feedRegion } from "@/features/setup/market-data/feed-region";

describe("feedRegion", () => {
  it.each([
    ["b3_cotahist", "BR"],
    ["b3_consolidated", "BR"],
    ["bcb_ptax", "BR"],
    ["tesouro_direto", "BR"],
    ["cvm_funds", "BR"],
    ["br_cdi", "BR"],
    ["br_ipca", "BR"],
    ["br_focus", "BR"],
    ["br_ifdata", "BR"],
    ["ecb", "EU"],
    ["eu_estr", "EU"],
    ["ea_hicp", "EU"],
    ["us_sofr", "US"],
    ["us_cpi", "US"],
    ["coinbase", "global"],
    ["yahoo_chart", "global"],
  ])("places %s in %s", (id, region) => {
    expect(feedRegion(id)).toBe(region);
  });

  it("places a source without a case in the global region", () => {
    expect(feedRegion("a_new_source")).toBe("global");
  });
});
