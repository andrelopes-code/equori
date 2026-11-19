import { rateSourceKeys } from "@/features/calculators/rate-source/rate-source-keys";

export const addressKeys = [
  "cash",
  "installment",
  "count",
  "first",
  ...rateSourceKeys("compare"),
] as const;
