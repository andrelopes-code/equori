import { useSyncExternalStore } from "react";

import type { SummaryMode } from "@/i18n/format";
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

export const summaryModes: readonly SummaryMode[] = [
  "full",
  "whole",
  "compact",
];

// Readers subscribe; a summary card reads the mode where it draws an amount.
export const summaryAmounts = preference<SummaryMode>(
  "equori.summaryAmounts",
  summaryModes,
  "full",
  () => undefined,
);

export function useSummaryAmounts(): [
  SummaryMode,
  (value: SummaryMode) => void,
] {
  return [
    useSyncExternalStore(summaryAmounts.subscribe, summaryAmounts.snapshot),
    summaryAmounts.apply,
  ];
}
