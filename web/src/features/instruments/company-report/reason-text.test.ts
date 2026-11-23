import { describe, expect, it } from "vitest";

import { reasonText } from "@/features/instruments/company-report/reason-text";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

const t = ((key) => catalogPtBR[key]) satisfies TFunction;

describe("reasonText", () => {
  it.each([
    ["shares", "número de ações não conferido"],
    ["loss", "prejuízo em 12 meses"],
    ["no_report", "sem demonstrações"],
  ])("writes %s in words", (reason, text) => {
    expect(reasonText(t, reason)).toBe(text);
  });

  it("reads a reason the catalog lacks, or a name of Object, as missing data", () => {
    expect(reasonText(t, "another_reason")).toBe("sem dado");
    expect(reasonText(t, "toString")).toBe("sem dado");
  });
});
