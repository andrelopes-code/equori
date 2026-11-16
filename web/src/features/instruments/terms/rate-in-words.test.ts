import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

import { rateInWords } from "@/features/instruments/terms/rate-in-words";

const t: TFunction = (key, vars) =>
  Object.entries(vars ?? {}).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    catalogEn[key],
  );

const base = { percent_of_index_bp: 10000, spread_bp: 0 };

describe("rateInWords", () => {
  it.each([
    [{ ...base, index_id: "cdi", percent_of_index_bp: 11000 }, "110% of CDI"],
    [{ ...base, index_id: "ipca", spread_bp: 650 }, "IPCA + 6.5%"],
    [{ ...base, spread_bp: 1200 }, "12% a year"],
    [
      { index_id: "cdi", percent_of_index_bp: 11000, spread_bp: 50 },
      "110% of CDI + 0.5%",
    ],
  ])("writes %j as %s", (terms, expected) => {
    expect(rateInWords(terms, t, "en-US")).toBe(expected);
  });
});
