import type { components } from "@/api/schema.gen";

type InstrumentType = components["schemas"]["InstrumentType"];

const scales: Record<InstrumentType, number> = {
  currency: 2,
  stock: 0,
  etf: 0,
  reit: 0,
  depositary_receipt: 0,
  fixed_income: 2,
  fund: 6,
  crypto: 8,
};

// A223 RM9: the decimal places of a quantity that a type takes when the owner types none.
export function scaleDefault(type: InstrumentType | null): number | null {
  return type === null ? null : scales[type];
}
