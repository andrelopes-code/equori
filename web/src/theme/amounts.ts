import { useSyncExternalStore } from "react";

import { preference } from "@/theme/preference";

// colour tints money in green and a loss red; sign leaves every amount in the text's own ink.
export type AmountToneMode = "colour" | "sign";

export const amountToneModes: readonly AmountToneMode[] = ["colour", "sign"];

// Readers subscribe; the tone is chosen where an amount is drawn, so there is nothing to paint.
export const amountToneMode = preference<AmountToneMode>(
  "equori.amountTone",
  amountToneModes,
  "colour",
  () => undefined,
);

export function useAmountToneMode(): [
  AmountToneMode,
  (value: AmountToneMode) => void,
] {
  return [
    useSyncExternalStore(amountToneMode.subscribe, amountToneMode.snapshot),
    amountToneMode.apply,
  ];
}
