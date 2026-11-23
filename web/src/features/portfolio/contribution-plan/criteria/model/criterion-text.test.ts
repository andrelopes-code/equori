import { describe, expect, it } from "vitest";

import { criterionText } from "@/features/portfolio/contribution-plan/criteria/model/criterion-text";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

const t = ((key) => catalogPtBR[key]) satisfies TFunction;

describe("criterionText", () => {
  it.each([
    ["price_earnings_max", "stored", "P/L de até"],
    ["piotroski_p1", "stored", "Retorno sobre os ativos positivo"],
    ["", "Entendo o negócio?", "Entendo o negócio?"],
    ["another_fact", "stored", "stored"],
  ])("writes the text of %s", (fact, stored, text) => {
    expect(criterionText(t, fact, stored)).toBe(text);
  });
});
