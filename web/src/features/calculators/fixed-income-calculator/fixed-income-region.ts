import type { Source } from "@/features/calculators/calculator-frame/method-section";
import type { MessageKey } from "@/i18n/catalog.en";

// The tax a region takes from the yield of fixed income, for the fixed-income calculator
// (calculators design §7). An extension point of ADR 016: docs/contributing/regions.md.
export interface FixedIncomeRules {
  // The tax on the yield of a taxable security held this many days, in basis points.
  taxBp(days: number): number;
  // The tax on the yield of a redemption held this many days, taken before the tax above and
  // deducted from its base, in basis points (spec 2026-11-19 RT1).
  redemptionBp(days: number): number;
  // The day the rules were last read against their sources.
  checkedOn: string;
  sources: readonly Source[];
  // Words of the region the method states after its steps.
  notes: readonly MessageKey[];
}

// Percent of the yield by day held, days 1 to 29 (Decreto 6.306/2007, Anexo).
const iofPercent = [
  96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36,
  33, 30, 26, 23, 20, 16, 13, 10, 6, 3,
];

// Null for a region without a case: the calculator asks for the tax rate.
export function fixedIncomeRules(region: string): FixedIncomeRules | null {
  switch (region) {
    case "BR":
      return {
        // Lei 11.033/2004, art. 1, in force after Medida Provisória 1.303/2025 expired unvoted.
        taxBp: (days) =>
          days <= 180 ? 2250 : days <= 360 ? 2000 : days <= 720 ? 1750 : 1500,
        // IOF of a redemption within 30 days (Decreto 6.306/2007, art. 32 and Anexo); the income
        // tax base is the yield net of it (Lei 8.981/1995, art. 65, § 1º).
        redemptionBp: (days) => (iofPercent[days - 1] ?? 0) * 100,
        checkedOn: "2026-11-19",
        sources: [
          {
            title: "Lei nº 11.033, de 21 de dezembro de 2004, art. 1",
            url: "https://www.planalto.gov.br/ccivil_03/_Ato2004-2006/2004/Lei/L11033compilado.htm",
          },
          {
            title:
              "Decreto nº 6.306, de 14 de dezembro de 2007, art. 32 e Anexo",
            url: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/D6306compilado.htm",
          },
          {
            title: "Lei nº 8.981, de 20 de janeiro de 1995, art. 65, § 1º",
            url: "https://www.planalto.gov.br/ccivil_03/leis/l8981.htm",
          },
          {
            title:
              "PwC, Tributação de aplicações financeiras e ativos virtuais (Ato Declaratório CN nº 67/2025)",
            url: "https://www.pwc.com.br/pt/consultoria-tributaria-societaria/thinking-about-taxes/tax-legis/2025/tributacao-de-aplicacoes-financeiras-e-ativos-virtuais.html",
          },
        ],
        notes: [
          "calc.fixedIncome.br.table",
          "calc.fixedIncome.br.iof",
          "calc.fixedIncome.br.days252",
        ],
      };
    case "DE":
      return {
        // EStG § 32d (1): 25% on income from capital; SolzG § 4: 5.5% of that tax, with no
        // allowance on tax withheld at source. Church tax and the yearly saver's allowance
        // depend on the person and are left out (the notes say so).
        taxBp: () => 2637.5,
        redemptionBp: () => 0,
        checkedOn: "2026-10-27",
        sources: [
          {
            title: "Einkommensteuergesetz (EStG), § 32d",
            url: "https://www.gesetze-im-internet.de/estg/__32d.html",
          },
          {
            title: "Solidaritätszuschlaggesetz 1995 (SolzG 1995), § 4",
            url: "https://www.gesetze-im-internet.de/solzg_1995/__4.html",
          },
        ],
        notes: ["calc.fixedIncome.de.rate", "calc.fixedIncome.de.left"],
      };
    case "PT":
      return {
        // CIRS art. 71.º, 1: interest is withheld at the final rate of 28%.
        taxBp: () => 2800,
        redemptionBp: () => 0,
        checkedOn: "2026-10-27",
        sources: [
          {
            title: "Código do IRS, artigo 71.º (Taxas liberatórias)",
            url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs71.aspx",
          },
        ],
        notes: ["calc.fixedIncome.pt.rate", "calc.fixedIncome.pt.left"],
      };
    default:
      return null;
  }
}
