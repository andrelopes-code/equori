import {
  rateSourceChoices,
  rateSourceKeys,
} from "@/features/calculators/rate-source/rate-source-keys";

export const addressKeys = [
  "cash",
  "installment",
  "count",
  "first",
  ...rateSourceKeys("compare"),
] as const;

export const choices = {
  first: ["now"],
  comparePeriod: rateSourceChoices.period,
  compareForm: rateSourceChoices.form,
  compareBasis: rateSourceChoices.basis,
} as const;
