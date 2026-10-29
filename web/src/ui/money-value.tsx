import { StatCardUnit, StatCardValue } from "@slotted/react/stat-card";

import { useMoneyFormat } from "@/privacy/use-money-format";

export interface MoneyAmount {
  money: { amount: number; currency: string };
  scale: number;
  // A positive amount is written with a leading plus, as useMoneyFormat().signed does.
  signed?: boolean;
}

// An amount as the value of a StatCard: the symbol and the minor digits take the card's unit part
// (smaller, medium weight, muted ink), so the whole units are what the eye reads first. The sign
// belongs to the quantity, not to the unit: it is written against the digits at their size, after
// the symbol, where a sign before the small symbol would stand alone at the figure's size.
// StatCardValue's emphasis="whole" formats a number through Intl; an amount here is an integer
// with its scale, written by useMoneyFormat, so its parts are drawn as children.
export function MoneyValue({ money, scale, signed = false }: MoneyAmount) {
  const fmt = useMoneyFormat();
  const segments = fmt.segments(money, scale);
  const sign =
    segments.find((segment) => segment.kind === "sign")?.text ??
    (signed && money.amount > 0 && !fmt.hidden ? "+" : "");
  return (
    <StatCardValue>
      {segments.map((segment) => {
        if (segment.kind === "sign") return null;
        if (segment.kind === "integer") return sign + segment.text;
        if (segment.kind === "symbol" || segment.kind === "fraction")
          return <StatCardUnit key={segment.kind}>{segment.text}</StatCardUnit>;
        return segment.text;
      })}
    </StatCardValue>
  );
}
