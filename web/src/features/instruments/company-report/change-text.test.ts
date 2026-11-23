import { describe, expect, it } from "vitest";

import { changeText } from "@/features/instruments/company-report/change-text";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

const t = ((key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  )) satisfies TFunction;

describe("changeText", () => {
  it.each([
    [{ state: "rate", rate: "0.2" }, "subiu 20%"],
    [{ state: "rate", rate: "-0.016884" }, "caiu 1,7%"],
    [{ state: "rate", rate: "0.0996" }, "subiu 10%"],
    [{ state: "rate", rate: "1.255" }, "subiu 126%"],
    [{ state: "rate", rate: "0.0004" }, "estável"],
    [{ state: "rate", rate: "0" }, "estável"],
    [{ state: "loss" }, "prejuízo"],
    [{ state: "turned" }, "voltou ao lucro"],
    [{ reason: "short_history" }, "sem dado"],
  ])("writes %j", (change, text) => {
    expect(changeText(t, "pt-BR", change)).toBe(text);
  });

  it("has its own words for the revenue", () => {
    expect(changeText(t, "pt-BR", { state: "loss" }, "revenue")).toBe(
      "sem receita",
    );
    expect(changeText(t, "pt-BR", { state: "turned" }, "revenue")).toBe(
      "voltou a ter receita",
    );
  });
});
