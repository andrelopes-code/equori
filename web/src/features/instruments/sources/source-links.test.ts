import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { sourceLinks } from "@/features/instruments/sources/source-links";

type Instrument = components["schemas"]["Instrument"];

describe("sourceLinks", () => {
  it.each(cases)("$name", ({ instrument, region, base, links }) => {
    const result = sourceLinks(instrument, { region, base });

    expect(result.map((link) => [link.id, link.href])).toEqual(links);
  });

  it("names the host of each address without the www prefix", () => {
    const result = sourceLinks(stock("PETR4", "BVMF"), {
      region: "BR",
      base: "BRL",
    });

    expect(result.map((link) => link.host)).toEqual([
      "google.com",
      "finance.yahoo.com",
      "fundamentus.com.br",
      "rad.cvm.gov.br",
    ]);
  });

  it("never exceeds four rows", () => {
    for (const { instrument, region, base } of cases) {
      expect(
        sourceLinks(instrument, { region, base }).length,
      ).toBeLessThanOrEqual(4);
    }
  });
});

const google = "https://www.google.com/finance/quote";
const yahoo = "https://finance.yahoo.com/quote";

function stock(code: string, exchange: string): Instrument {
  return {
    code,
    type: "stock",
    scale: 0,
    name: code,
    exchange,
    quote_currency: "BRL",
  };
}

const cases: {
  name: string;
  instrument: Instrument;
  region: string;
  base: string;
  links: [string, string][];
}[] = [
  {
    name: "a Brazilian stock holds the two global and the two regional sources",
    instrument: stock("PETR4", "BVMF"),
    region: "BR",
    base: "BRL",
    links: [
      ["google_finance", `${google}/PETR4:BVMF`],
      ["yahoo_finance", `${yahoo}/PETR4.SA/`],
      [
        "fundamentus",
        "https://www.fundamentus.com.br/detalhes.php?papel=PETR4",
      ],
      ["cvm_rad", "https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx"],
    ],
  },
  {
    name: "a real estate fund has no filing source",
    instrument: { ...stock("MXRF11", "BVMF"), type: "reit" },
    region: "BR",
    base: "BRL",
    links: [
      ["google_finance", `${google}/MXRF11:BVMF`],
      ["yahoo_finance", `${yahoo}/MXRF11.SA/`],
      [
        "fundamentus",
        "https://www.fundamentus.com.br/detalhes.php?papel=MXRF11",
      ],
    ],
  },
  {
    name: "a foreign stock of a Brazilian book holds the global sources only",
    instrument: { ...stock("NVDA", "XNAS"), quote_currency: "USD" },
    region: "BR",
    base: "BRL",
    links: [
      ["google_finance", `${google}/NVDA:NASDAQ`],
      ["yahoo_finance", `${yahoo}/NVDA/`],
    ],
  },
  {
    name: "a region without a case holds the global sources only",
    instrument: stock("PETR4", "BVMF"),
    region: "US",
    base: "USD",
    links: [
      ["google_finance", `${google}/PETR4:BVMF`],
      ["yahoo_finance", `${yahoo}/PETR4.SA/`],
    ],
  },
  {
    name: "a symbol held under the Yahoo source replaces the derived one",
    instrument: {
      ...stock("PETR4", "BVMF"),
      symbols: { yahoo_chart: "PETR4.SA.X" },
    },
    region: "US",
    base: "USD",
    links: [
      ["google_finance", `${google}/PETR4:BVMF`],
      ["yahoo_finance", `${yahoo}/PETR4.SA.X/`],
    ],
  },
  {
    name: "a stock on an exchange without a case has no link",
    instrument: stock("ABC", "XETR"),
    region: "BR",
    base: "BRL",
    links: [],
  },
  {
    name: "a crypto pairs its code with its quote currency",
    instrument: {
      code: "BTC",
      type: "crypto",
      scale: 8,
      name: "Bitcoin",
      quote_currency: "USD",
    },
    region: "BR",
    base: "BRL",
    links: [
      ["google_finance", `${google}/BTC-USD`],
      ["yahoo_finance", `${yahoo}/BTC-USD/`],
    ],
  },
  {
    name: "a crypto whose code ends with its quote currency has no link",
    instrument: {
      code: "BTCBRL",
      type: "crypto",
      scale: 8,
      name: "Bitcoin in reais",
      quote_currency: "BRL",
    },
    region: "BR",
    base: "BRL",
    links: [],
  },
  {
    name: "a currency pairs its code with the base currency",
    instrument: { code: "USD", type: "currency", scale: 2, name: "Dollar" },
    region: "BR",
    base: "BRL",
    links: [
      ["google_finance", `${google}/USD-BRL`],
      ["yahoo_finance", `${yahoo}/USDBRL=X/`],
      [
        "bcb_ptax",
        "https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes",
      ],
    ],
  },
  {
    name: "a currency of a book with another base has no Brazilian rate",
    instrument: { code: "USD", type: "currency", scale: 2, name: "Dollar" },
    region: "BR",
    base: "EUR",
    links: [
      ["google_finance", `${google}/USD-EUR`],
      ["yahoo_finance", `${yahoo}/USDEUR=X/`],
    ],
  },
  {
    name: "the base currency has no link",
    instrument: { code: "BRL", type: "currency", scale: 2, name: "Real" },
    region: "BR",
    base: "BRL",
    links: [],
  },
  {
    name: "a Treasury bond holds the two official sources",
    instrument: {
      code: "TSELIC29",
      type: "fixed_income",
      subtype: "tesouro",
      scale: 2,
      name: "Tesouro Selic 2029",
      quote_currency: "BRL",
    },
    region: "BR",
    base: "BRL",
    links: [
      [
        "tesouro_direto",
        "https://www.tesourodireto.com.br/produtos/dados-sobre-titulos/rendimento-dos-titulos",
      ],
      [
        "tesouro_transparente",
        "https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto",
      ],
    ],
  },
  {
    name: "a bank certificate has no link",
    instrument: {
      code: "CDBXP27",
      type: "fixed_income",
      subtype: "cdb",
      scale: 2,
      name: "CDB XP 2027",
      quote_currency: "BRL",
    },
    region: "BR",
    base: "BRL",
    links: [],
  },
  {
    name: "an investment fund holds the regulator register",
    instrument: {
      code: "FUNDO1",
      type: "fund",
      scale: 2,
      name: "Fundo 1",
      quote_currency: "BRL",
    },
    region: "BR",
    base: "BRL",
    links: [["cvm_funds", "https://web.cvm.gov.br/app/fundosweb/"]],
  },
];
