import { rateSourceKeys } from "@/features/calculators/rate-source/rate-source-keys";

export const addressKeys = [
  "amount",
  "days",
  "daysUnit",
  "kind",
  "taxRate",
  ...rateSourceKeys("rate"),
] as const;
