import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

import { yieldNote } from "@/features/portfolio/yield-note";

const t: TFunction = (key, params) =>
  catalogEn[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

const benchmark = {
  index: "cdi",
  from: "2025-10-17",
  until: "2026-10-16",
  index_bp: 1490,
  days: 245,
};

describe("yieldNote", () => {
  it("states the percent, the index's rate a year and the days compared", () => {
    expect(
      yieldNote(
        { ...benchmark, percent_bp: 10180, index_annual_bp: 1490 },
        t,
        "en",
      ),
    ).toBe("101.80% of CDI · CDI 14.90% a year · 10/17/2025 to 10/16/2026");
  });

  it("states only the days when the comparison holds no rate a year", () => {
    expect(yieldNote(benchmark, t, "en")).toBe("10/17/2025 to 10/16/2026");
  });
});
