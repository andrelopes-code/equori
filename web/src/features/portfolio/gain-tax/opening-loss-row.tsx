import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import type { LossRow } from "@/features/portfolio/gain-tax/opening-loss-rows";
import { catalogLabel, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money/money-input";
import { MonthControl } from "@/ui/navigation/month-control";

interface OpeningLossRowProps {
  row: LossRow;
  currency: string;
  onChange: (patch: Partial<LossRow>) => void;
}

// LO4: the pool, the month its loss counts from and the amount, on one line.
export function OpeningLossRow({
  row,
  currency,
  onChange,
}: OpeningLossRowProps) {
  const t = useT();
  const scale = useScale();
  const pool = catalogLabel(t, `taxYear.pool.${row.pool}`, row.pool);

  if (scale === null) return null;

  return (
    <Inline gap={4} wrap="nowrap" align="center">
      <Text>{pool}</Text>
      <MonthControl
        label={`${pool} · ${t("gainTax.openingLosses.month")}`}
        value={row.month}
        onChange={(month) => {
          onChange({ month });
        }}
      />
      <MoneyInput
        size="field"
        sign="neutral"
        currency={currency}
        scale={scale(currency)}
        aria-label={`${pool} · ${t("gainTax.openingLosses.amount")}`}
        value={row.amount}
        onChange={(amount) => {
          onChange({ amount });
        }}
      />
    </Inline>
  );
}
