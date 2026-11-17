import { Fragment } from "react";

import type { components } from "@/api/schema.gen";
import { MoneyFigure } from "@/ui/money/money-figure";

type Money = components["schemas"]["Money"];

const plus = " + ";

interface UpcomingTotalProps {
  amounts: readonly Money[];
  scale: (currency: string) => number;
}

// The amounts of one total, one per currency, joined by a plus sign: currencies are not added.
export function UpcomingTotal({ amounts, scale }: UpcomingTotalProps) {
  return amounts.map((money, index) => (
    <Fragment key={money.currency}>
      {index > 0 && plus}
      <MoneyFigure
        amount={money.amount}
        currency={money.currency}
        scale={scale(money.currency)}
      />
    </Fragment>
  ));
}
