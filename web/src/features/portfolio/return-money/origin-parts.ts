import type { ReturnMoney } from "@/features/portfolio/return-money/return-money";

export interface OriginPart {
  key: "opening" | "deposits" | "gain";
  amount: number;
}

// RK4: the parts of the closing balance drawn as lengths. A length cannot show a negative part
// and one part alone says nothing, so the bar needs a gain above zero, no negative part and two
// parts above zero; a part of zero is left out.
export function originParts(money: ReturnMoney): OriginPart[] | undefined {
  const parts: OriginPart[] = [
    { key: "opening", amount: money.opening },
    { key: "deposits", amount: money.deposits },
    { key: "gain", amount: money.gain },
  ];
  const drawn = parts.filter((part) => part.amount > 0);
  const whole =
    money.gain > 0 &&
    parts.every((part) => part.amount >= 0) &&
    drawn.length >= 2;

  return whole ? drawn : undefined;
}
