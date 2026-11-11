import type { MessageKey } from "@/i18n/catalog.en";

// The words a region gives the two amortization systems of the financing calculator. An
// extension point of ADR 016: docs/contributing/regions.md. A region without a case reads them
// by what each system keeps fixed.
export interface SystemNames {
  price: MessageKey;
  sac: MessageKey;
  installment: MessageKey;
  compare: MessageKey;
  priceTable: MessageKey;
  sacTable: MessageKey;
  // Said after the method's steps: the region's names for the two systems.
  note: MessageKey | null;
}

export function systemNames(region: string): SystemNames {
  switch (region) {
    case "BR":
      return {
        price: "calc.financing.br.price",
        sac: "calc.financing.br.sac",
        installment: "calc.financing.br.installment",
        compare: "calc.financing.br.compare",
        priceTable: "calc.financing.br.priceTable",
        sacTable: "calc.financing.br.sacTable",
        note: "calc.financing.br.names",
      };
    default:
      return {
        price: "calc.financing.price",
        sac: "calc.financing.sac",
        installment: "calc.financing.installment",
        compare: "calc.financing.compare",
        priceTable: "calc.financing.priceTable",
        sacTable: "calc.financing.sacTable",
        note: null,
      };
  }
}
