export interface ExchangeSymbols {
  // The code Google Finance puts after the instrument code.
  google: string;
  // The suffix Yahoo Finance adds to the instrument code.
  yahooSuffix: string;
}

// What the two global sources call an exchange, by MIC. An extension point of ADR 016:
// docs/contributing/regions.md. Null for an exchange without a case: no global link.
export function exchangeSymbols(mic: string): ExchangeSymbols | null {
  switch (mic) {
    case "BVMF":
      return { google: "BVMF", yahooSuffix: ".SA" };
    case "XNAS":
      return { google: "NASDAQ", yahooSuffix: "" };
    case "XNYS":
      return { google: "NYSE", yahooSuffix: "" };
    default:
      return null;
  }
}
