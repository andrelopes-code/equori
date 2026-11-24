import { describe, expect, it } from "vitest";

import { feedRegion } from "@/features/setup/market-data/feed-region";

describe("feedRegion", () => {
  it.each([
    ["b3_cotahist", "BR"],
    ["b3_consolidated", "BR"],
    ["b3_price_report", "BR"],
    ["bcb_ptax", "BR"],
    ["tesouro_direto", "BR"],
    ["cvm_funds", "BR"],
    ["br_cdi", "BR"],
    ["br_ipca", "BR"],
    ["br_selic", "BR"],
    ["br_igpm", "BR"],
    ["br_ptax_usd", "BR"],
    ["br_ibovespa", "BR"],
    ["br_ifix", "BR"],
    ["br_focus", "BR"],
    ["br_focus_ipca", "BR"],
    ["br_tesouro", "BR"],
    ["br_ifdata", "BR"],
    ["br_cvm_fii", "BR"],
    ["br_cvm_cia", "BR"],
    ["ecb", "EU"],
    ["eu_estr", "EU"],
    ["ea_hicp", "EU"],
    ["us_sofr", "US"],
    ["us_cpi", "US"],
    ["us_sp500", "US"],
    ["global_ftse", "global"],
    ["coinbase", "global"],
    ["yahoo_chart", "global"],
  ])("places %s in %s", (id, region) => {
    expect(feedRegion(id)).toBe(region);
  });

  it("places a source without a case in the global region", () => {
    expect(feedRegion("a_new_source")).toBe("global");
  });
});
