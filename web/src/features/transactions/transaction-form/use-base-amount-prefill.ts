import { useEffect } from "react";

import { grossOf } from "@/features/transactions/entry-model/trade-math";

interface BaseAmountPrefillInput {
  // The stored rate as decimal text; undefined while none is known.
  rate: string | undefined;
  amount: number;
  amountScale: number;
  baseScale: number;
  value: number;
  typed: boolean;
  onPrefill: (value: number) => void;
}

// Until the owner types the value, it follows the amount at the stored rate.
export function useBaseAmountPrefill({
  rate,
  amount,
  amountScale,
  baseScale,
  value,
  typed,
  onPrefill,
}: BaseAmountPrefillInput) {
  const converted =
    rate === undefined ? null : grossOf(amount, amountScale, rate, baseScale);

  useEffect(() => {
    if (typed || converted === null || converted === value) return;

    onPrefill(converted);
  }, [typed, converted, value, onPrefill]);
}
