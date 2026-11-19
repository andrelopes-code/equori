import { rateSourceChoices } from "@/features/calculators/rate-source/rate-source-keys";

export const addressKeys = [
  "initial",
  "deposit",
  "target",
  "rate",
  "inflation",
  "volatility",
  "share",
  "period",
  "months",
  "delay",
  "withdraw",
  "monthsUnit",
  "delayUnit",
  "withdrawUnit",
  "mode",
  "index",
  "inflationIndex",
  "form",
  "percent",
  "spread",
  "basis",
] as const;

// The values the address accepts for each choice; the readers take their lists from here.
export const choices = {
  period: rateSourceChoices.period,
  monthsUnit: ["month", "year"],
  delayUnit: ["month", "year"],
  withdrawUnit: ["year", "month"],
  mode: ["final", "target", "income"],
  form: rateSourceChoices.form,
  basis: rateSourceChoices.basis,
} as const;
