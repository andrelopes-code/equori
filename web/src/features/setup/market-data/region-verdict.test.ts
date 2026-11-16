import { describe, expect, it } from "vitest";

import {
  othersSummary,
  regionLine,
  regionVerdict,
} from "@/features/setup/market-data/region-verdict";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";

const t = (key: MessageKey, vars: Record<string, string | number> = {}) =>
  Object.entries(vars).reduce(
    (text: string, [name, value]) => text.replace(`{${name}}`, String(value)),
    catalogEn[key],
  );

describe("regionVerdict", () => {
  it("says no feed is active before anything else", () => {
    expect(regionVerdict({ total: 3, enabled: 0, problems: 0 }, t)).toEqual({
      text: "None active",
      tone: "muted",
    });
  });

  it.each([
    [1, "1 with a problem"],
    [2, "2 with problems"],
  ])("counts %i feeds with a problem in the warning tone", (problems, text) => {
    expect(regionVerdict({ total: 4, enabled: 3, problems }, t)).toEqual({
      text,
      tone: "warning",
    });
  });

  it("says a healthy region is up to date", () => {
    expect(regionVerdict({ total: 8, enabled: 8, problems: 0 }, t)).toEqual({
      text: "Up to date",
      tone: "ok",
    });
  });
});

describe("regionLine", () => {
  it("writes the active count", () => {
    expect(regionLine({ total: 8, enabled: 8, problems: 0 }, t)).toBe(
      "8 of 8 active",
    );
  });

  it("writes the singular for one source", () => {
    expect(regionLine({ total: 1, enabled: 0, problems: 0 }, t)).toBe(
      "0 of 1 active",
    );
  });
});

describe("othersSummary", () => {
  it("counts regions, sources and active sources", () => {
    expect(
      othersSummary(
        [
          { total: 3, enabled: 1, problems: 0 },
          { total: 2, enabled: 0, problems: 0 },
        ],
        t,
      ),
    ).toBe("2 regions · 5 sources · 1 active");
  });

  it("writes none active, in the singular for one region", () => {
    expect(othersSummary([{ total: 1, enabled: 0, problems: 0 }], t)).toBe(
      "1 region · 1 source · none active",
    );
  });
});
