import {
  rateSourceChoices,
  rateSourceKeys,
} from "@/features/calculators/rate-source/rate-source-keys";

export const addressKeys = [
  "amount",
  "days",
  "daysUnit",
  "kind",
  "taxRate",
  ...rateSourceKeys("rate"),
] as const;

export const choices = {
  daysUnit: ["day", "month", "year"],
  kind: ["taxable", "exempt"],
  ratePeriod: rateSourceChoices.period,
  rateForm: rateSourceChoices.form,
  rateBasis: rateSourceChoices.basis,
} as const;
