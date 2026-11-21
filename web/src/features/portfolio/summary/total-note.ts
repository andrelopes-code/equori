import type { components } from "@/api/schema.gen";
import type { TFunction } from "@/i18n/i18n-provider";

type Money = components["schemas"]["Money"];

export interface TotalNoteParts {
  realized: number;
  income: number;
  outside: readonly Money[];
}

export interface TotalNoteWriters {
  signed: (amount: number) => string;
  money: (m: Money) => string;
}

// A262 TR4: the sales and the income beside the gain of the figure next to it, then the amounts in
// another currency the value leaves out.
export function totalNote(
  t: TFunction,
  parts: TotalNoteParts,
  write: TotalNoteWriters,
): string {
  return [
    t("holdings.total.note", {
      realized: write.signed(parts.realized),
      income: write.signed(parts.income),
    }),
    ...(parts.outside.length > 0
      ? [
          t("holdings.total.outside", {
            amounts: parts.outside.map(write.money).join(" · "),
          }),
        ]
      : []),
  ].join(" · ");
}
