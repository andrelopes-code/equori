import type { components } from "@/api/schema.gen";

type InstrumentType = components["schemas"]["InstrumentType"];
type ProbeInput = components["schemas"]["ProbeInput"];

const codePattern = /^[A-Z0-9.]{2,20}$/;
const exchangeLength = 4;

// The request of the probe, or null while the form lacks a field the contract requires.
export function probeInput(form: {
  code: string;
  type: InstrumentType | null;
  exchange: string;
  quote: string | null;
}): ProbeInput | null {
  const code = form.code.trim().toUpperCase();
  const exchange = form.exchange.trim();
  if (!codePattern.test(code) || form.type === null || form.quote === null)
    return null;
  if (exchange !== "" && exchange.length !== exchangeLength) return null;

  return {
    code,
    type: form.type,
    ...(exchange === "" ? {} : { exchange }),
    quote_currency: form.quote,
  };
}
