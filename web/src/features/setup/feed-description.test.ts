import { describe, expect, it } from "vitest";

import { feedDescription } from "@/features/setup/feed-description";
import type { components } from "@/api/schema.gen";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

type MarketDataFeed = components["schemas"]["MarketDataFeed"];

const t: TFunction = (key, params) =>
  catalogEn[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

const base: MarketDataFeed = {
  id: "x",
  kind: "price",
  enabled: true,
  suggested: false,
  last: null,
  stale: false,
  last_run: null,
  error: null,
  official: true,
  covers: 0,
  history_pending: 0,
  symbol_override: false,
};

describe("feedDescription", () => {
  const cases: [string, Partial<MarketDataFeed>, string][] = [
    [
      "coverage and pending history",
      { covers: 1, history_pending: 2 },
      "Nothing stored yet · Covers 1 instrument · Loading history: 2 pending",
    ],
    [
      "no coverage, unofficial",
      { official: false },
      "Nothing stored yet · Covers no instrument · Not official",
    ],
    [
      "failure",
      { error: "status 500", covers: 3 },
      "Last update failed: status 500 · Covers 3 instruments",
    ],
    ["index feed", { kind: "index" }, "Nothing stored yet"],
  ];

  it.each(cases)("%s", (_, patch, want) => {
    expect(feedDescription({ ...base, ...patch }, t, "en-US")).toBe(want);
  });
});
