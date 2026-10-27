import type { Source } from "@/features/calculators/method-section";
import type { MessageKey } from "@/i18n/catalog.en";

// The tax a region takes from the yield of fixed income, for the fixed-income calculator
// (calculators design §7). An extension point of ADR 016: docs/contributing/regions.md.
export interface FixedIncomeRules {
  // The tax on the yield of a taxable security held this many days, in basis points.
  taxBp(days: number): number;
  // Below this many days another tax applies that the calculator does not compute.
  minimumDays: number;
  // The day the rules were last read against their sources.
  checkedOn: string;
  sources: readonly Source[];
  // Words of the region the method states after its steps.
  notes: readonly MessageKey[];
}

// Null for a region without a case: the calculator asks for the tax rate.
export function fixedIncomeRules(region: string): FixedIncomeRules | null {
  switch (region) {
    case "BR":
      return {
        // Lei 11.033/2004, art. 1, in force after Medida Provisória 1.303/2025 expired unvoted.
        taxBp: (days) =>
          days <= 180 ? 2250 : days <= 360 ? 2000 : days <= 720 ? 1750 : 1500,
        // IOF applies to a redemption within 30 days (Decreto 6.306/2007, art. 32).
        minimumDays: 30,
        checkedOn: "2026-10-26",
        sources: [
          {
            title: "Lei nº 11.033, de 21 de dezembro de 2004, art. 1",
            url: "https://www.planalto.gov.br/ccivil_03/_Ato2004-2006/2004/Lei/L11033compilado.htm",
          },
          {
            title:
              "PwC, Tributação de aplicações financeiras e ativos virtuais (Ato Declaratório CN nº 67/2025)",
            url: "https://www.pwc.com.br/pt/consultoria-tributaria-societaria/thinking-about-taxes/tax-legis/2025/tributacao-de-aplicacoes-financeiras-e-ativos-virtuais.html",
          },
        ],
        notes: ["calc.fixedIncome.br.table", "calc.fixedIncome.br.days252"],
      };
    default:
      return null;
  }
}
