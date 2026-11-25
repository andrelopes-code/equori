import { describe, expect, it } from "vitest";

import { referenceTexts } from "@/features/portfolio/projection/plan-section/reference-texts";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

const t: TFunction = (key, vars) =>
  catalogEn[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name] ?? ""),
  );

const input = {
  realBp: 550,
  cautiousBp: 350,
  favorableBp: 700,
  curve: { index: "ipca", year: 2040, rate: 0.0754 },
  portfolio: 0.138,
};

describe("referenceTexts", () => {
  it("PX17: names each row and writes its rate", () => {
    expect(referenceTexts(input, t, "en-US")).toEqual({
      plan: { name: "Plan range", value: "3.50% to 7.00%" },
      curve: { name: "IPCA+ 2040", value: "7.54%" },
      portfolio: { name: "Your portfolio", value: "13.8%" },
    });
  });

  it("PX17: a plan without its cases writes the expected return alone", () => {
    const texts = referenceTexts(
      { ...input, cautiousBp: null, favorableBp: null, curve: null },
      t,
      "en-US",
    );

    expect(texts.plan.value).toBe("5.50%");
    expect(texts.curve.value).toBe("");
  });
});
