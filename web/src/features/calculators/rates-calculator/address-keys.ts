import { rateSourceChoices } from "@/features/calculators/rate-source/rate-source-keys";

export const addressKeys = [
  "rate",
  "inflation",
  "period",
  "index",
  "form",
  "percent",
  "spread",
  "basis",
] as const;

export const choices = {
  period: rateSourceChoices.period,
  form: rateSourceChoices.form,
  basis: rateSourceChoices.basis,
} as const;
