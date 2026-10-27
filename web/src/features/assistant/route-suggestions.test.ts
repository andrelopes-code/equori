import { describe, expect, it } from "vitest";

import { routeSuggestions } from "@/features/assistant/route-suggestions";
import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";

describe("routeSuggestions", () => {
  it.each([
    ["/transactions/abc", "transactions"],
    ["/cards", "cards"],
    ["/planning/schedules", "planning"],
    ["/reports/x", "reports"],
    ["/overview", "overview"],
    ["/", "overview"],
    ["/settings", "other"],
  ])("%s suggests the %s questions", (path, group) => {
    expect(routeSuggestions(path)).toEqual([
      `assistant.suggestion.${group}.1`,
      `assistant.suggestion.${group}.2`,
      `assistant.suggestion.${group}.3`,
    ]);
  });

  it("names keys of both catalogs", () => {
    for (const path of [
      "/",
      "/transactions",
      "/cards",
      "/planning",
      "/reports",
      "/settings",
    ]) {
      for (const key of routeSuggestions(path)) {
        expect(catalogEn[key]).toBeTruthy();
        expect(catalogPtBR[key]).toBeTruthy();
      }
    }
  });
});
