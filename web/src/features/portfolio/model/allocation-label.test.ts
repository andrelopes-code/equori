import { describe, expect, it } from "vitest";

import { allocationLabel } from "@/features/portfolio/model/allocation-label";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

const t: TFunction = (key) => catalogEn[key];
const none = new Map<string, string>();

describe("allocationLabel", () => {
  it.each([
    ["type", "property", "Property"],
    ["type", "unknown_type", "unknown_type"],
    ["currency", "BRL", "BRL"],
    ["institution", "", catalogEn["portfolio.allocation.noInstitution"]],
  ] as const)("names the %s group %s as %s", (by, key, want) => {
    expect(allocationLabel(t, by, key, none)).toBe(want);
  });
});
