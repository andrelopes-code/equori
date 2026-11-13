import type { components } from "@/api/schema.gen";

type Instrument = components["schemas"]["Instrument"];

export type SourceLinkId =
  | "google_finance"
  | "yahoo_finance"
  | "fundamentus"
  | "cvm_rad"
  | "cvm_funds"
  | "bcb_ptax"
  | "tesouro_direto"
  | "tesouro_transparente";

export interface SourceAddress {
  id: SourceLinkId;
  href: string;
}

const brazilExchange = "BVMF";

const cvmRad: SourceAddress = {
  id: "cvm_rad",
  href: "https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx",
};

const treasuryLinks: SourceAddress[] = [
  {
    id: "tesouro_direto",
    href: "https://www.tesourodireto.com.br/produtos/dados-sobre-titulos/rendimento-dos-titulos",
  },
  {
    id: "tesouro_transparente",
    href: "https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto",
  },
];

// The sources a region adds to the global ones. An extension point of ADR 016:
// docs/contributing/regions.md. Empty for a region without a case.
export function regionalLinks(
  region: string,
  instrument: Instrument,
  base: string,
): SourceAddress[] {
  switch (region) {
    case "BR":
      return brazilLinks(instrument, base);
    default:
      return [];
  }
}

function brazilLinks(instrument: Instrument, base: string): SourceAddress[] {
  const { code, type, subtype, exchange } = instrument;
  const listed = exchange === brazilExchange;

  if (listed && (type === "stock" || type === "reit" || type === "etf")) {
    return [
      {
        id: "fundamentus",
        href: `https://www.fundamentus.com.br/detalhes.php?papel=${code}`,
      },
      ...(type === "stock" ? [cvmRad] : []),
    ];
  }
  if (type === "fund") {
    return [{ id: "cvm_funds", href: "https://web.cvm.gov.br/app/fundosweb/" }];
  }
  if (type === "currency" && base === "BRL" && code !== base) {
    return [
      {
        id: "bcb_ptax",
        href: "https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes",
      },
    ];
  }
  if (type === "fixed_income" && subtype === "tesouro") {
    return treasuryLinks;
  }

  return [];
}
