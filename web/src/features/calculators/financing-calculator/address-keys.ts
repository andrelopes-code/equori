export const addressKeys = [
  "amount",
  "installment",
  "prepayAmount",
  "rate",
  "period",
  "months",
  "monthsUnit",
  "prepayMonth",
  "solve",
] as const;

export const choices = {
  period: ["month", "year"],
  monthsUnit: ["month", "year"],
  solve: ["installment", "amount", "rate", "months"],
} as const;
