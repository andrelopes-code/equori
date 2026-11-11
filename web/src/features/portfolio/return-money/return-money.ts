import type { components } from "@/api/schema.gen";

type ReturnReport = components["schemas"]["ReturnReport"];

export interface ReturnMoney {
  currency: string;
  opening: number;
  deposits: number;
  hasFlows: boolean;
  gain: number;
  closing: number;
}

// RC4: the gain is what the balance grew beyond the net deposits. A sum holds one currency, so
// a report whose amounts differ in currency has no money result.
export function returnMoney(report: ReturnReport): ReturnMoney | undefined {
  const { opening, closing, flows } = report;
  const currency = opening.currency;
  const sameCurrency =
    closing.currency === currency &&
    flows.every((flow) => flow.amount.currency === currency);

  if (!sameCurrency) {
    return undefined;
  }

  const deposits = flows.reduce((sum, flow) => sum + flow.amount.amount, 0);

  return {
    currency,
    opening: opening.amount,
    deposits,
    hasFlows: flows.length > 0,
    gain: closing.amount - opening.amount - deposits,
    closing: closing.amount,
  };
}
