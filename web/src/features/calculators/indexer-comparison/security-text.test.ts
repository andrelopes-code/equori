import { describe, expect, it } from "vitest";

import { securityText } from "@/features/calculators/indexer-comparison/security-text";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

const t: TFunction = (key, vars) =>
  catalogEn[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    vars?.[name] === undefined ? whole : String(vars[name]),
  );

describe("securityText", () => {
  it.each([
    [{ form: "fixed", rate: 0.08, taxed: true }, "Fixed 8.00% a year"],
    [{ form: "percent", index: "cdi", rate: 1.4, taxed: true }, "140% of CDI"],
    [
      { form: "spread", index: "ipca", rate: 0.065, taxed: false },
      "IPCA + 6.50% a year",
    ],
  ] as const)("writes %j in words", (security, text) => {
    expect(securityText(security, t, "en-US")).toBe(text);
  });

  it.each([
    [{ form: "fixed", rate: null, taxed: true }, "Fixed rate"],
    [{ form: "percent", index: "cdi", rate: null, taxed: true }, "% of CDI"],
    [
      { form: "spread", index: "ipca", rate: null, taxed: true },
      "IPCA + spread",
    ],
  ] as const)(
    "names the form of %j while the rate is not a number",
    (security, text) => {
      expect(securityText(security, t, "en-US")).toBe(text);
    },
  );
});
