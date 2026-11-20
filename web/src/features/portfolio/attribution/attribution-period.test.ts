import { describe, expect, it } from "vitest";

import { attributionPeriod } from "@/features/portfolio/attribution/attribution-period";
import type { TFunction } from "@/i18n/i18n-provider";

const t: TFunction = (key, vars) =>
  `${key}${vars === undefined ? "" : JSON.stringify(vars)}`;
const dayMonth = (iso: string) => iso.slice(5);

function year(to: string, since?: string) {
  return {
    year: 2026,
    from: "2026-01-01",
    to,
    ...(since === undefined ? {} : { since }),
  };
}

describe("attributionPeriod", () => {
  it.each([
    ["a closed year", year("2026-12-31", "2026-01-01"), "2026"],
    [
      "a partial year",
      year("2026-11-20", "2026-01-01"),
      'portfolio.attribution.period.partial{"year":"2026","day":"11-20"}',
    ],
    [
      "a year whose money came late",
      year("2026-12-31", "2026-11-09"),
      'portfolio.attribution.period.since{"year":"2026","since":"11-09"}',
    ],
    [
      "a partial year whose money came late",
      year("2026-11-20", "2026-11-09"),
      'portfolio.attribution.period.between{"year":"2026","since":"11-09","day":"11-20"}',
    ],
  ])("names %s", (_, y, want) => {
    expect(attributionPeriod(y, t, dayMonth)).toBe(want);
  });
});
