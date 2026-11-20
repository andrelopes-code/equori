interface Missing {
  instrument: string;
  kind: "price" | "rate";
}

interface Quoted {
  code: string;
  quote_currency?: string | null;
}

export interface MissingQuote {
  instrument: string;
  quote: string;
  kind: "price" | "rate";
}

// The price each entry of the verdict lacks, once per instrument: a security in its quote
// currency, a currency in the base. An entry with no such pair is left out.
export function missingQuotes(
  missing: readonly Missing[],
  instruments: readonly Quoted[],
  base: string | undefined,
): MissingQuote[] {
  const out: MissingQuote[] = [];

  for (const m of missing) {
    if (out.some((q) => q.instrument === m.instrument)) continue;

    const instrument = instruments.find((i) => i.code === m.instrument);
    const quote = instrument?.quote_currency ?? base;
    if (
      instrument === undefined ||
      quote === undefined ||
      quote === m.instrument
    )
      continue;

    out.push({ instrument: m.instrument, quote, kind: m.kind });
  }

  return out;
}
