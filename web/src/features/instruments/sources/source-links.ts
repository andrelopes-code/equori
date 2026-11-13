import type { components } from "@/api/schema.gen";
import { exchangeSymbols } from "@/features/instruments/sources/exchange-symbols";
import {
  regionalLinks,
  type SourceAddress,
} from "@/features/instruments/sources/source-links-region";

type Instrument = components["schemas"]["Instrument"];

const google = "https://www.google.com/finance/quote";
const yahoo = "https://finance.yahoo.com/quote";

export interface SourceLinkContext {
  region: string;
  // The book's base currency, the other side of a currency pair.
  base: string;
}

export interface SourceLink extends SourceAddress {
  host: string;
}

// The external pages that show the instrument, in reading order (design 2026-11-13). An
// instrument no source covers has none.
export function sourceLinks(
  instrument: Instrument,
  context: SourceLinkContext,
): SourceLink[] {
  return [
    ...globalLinks(instrument, context.base),
    ...regionalLinks(context.region, instrument, context.base),
  ].map((address) => ({ ...address, host: hostOf(address.href) }));
}

function globalLinks(instrument: Instrument, base: string): SourceAddress[] {
  switch (instrument.type) {
    case "stock":
    case "reit":
    case "etf":
    case "depositary_receipt":
      return securityLinks(instrument);
    case "crypto":
      return cryptoLinks(instrument);
    case "currency":
      return currencyLinks(instrument.code, base);
    default:
      return [];
  }
}

function securityLinks(instrument: Instrument): SourceAddress[] {
  const symbols = exchangeSymbols(instrument.exchange ?? "");
  if (symbols === null) return [];

  const { code } = instrument;
  const yahooSymbol =
    instrument.symbols?.yahoo_chart ?? code + symbols.yahooSuffix;

  return [
    { id: "google_finance", href: `${google}/${code}:${symbols.google}` },
    { id: "yahoo_finance", href: `${yahoo}/${yahooSymbol}/` },
  ];
}

// A code that already ends with its quote currency (BTCBRL) cannot be split into a pair.
function cryptoLinks(instrument: Instrument): SourceAddress[] {
  const { code, quote_currency: quote } = instrument;
  if (quote === undefined || code.endsWith(quote)) return [];

  return [
    { id: "google_finance", href: `${google}/${code}-${quote}` },
    { id: "yahoo_finance", href: `${yahoo}/${code}-${quote}/` },
  ];
}

function currencyLinks(code: string, base: string): SourceAddress[] {
  if (code === base) return [];

  return [
    { id: "google_finance", href: `${google}/${code}-${base}` },
    { id: "yahoo_finance", href: `${yahoo}/${code}${base}=X/` },
  ];
}

function hostOf(href: string): string {
  return new URL(href).hostname.replace(/^www\./, "");
}
