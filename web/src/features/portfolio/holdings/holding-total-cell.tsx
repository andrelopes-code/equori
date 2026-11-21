import { Text } from "@slotted/react/typography";

import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { directionOf, useAmountTone } from "@/ui/money/amount-tone";

interface HoldingTotalCellProps {
  holding: Holding;
  valueIn: string;
}

// A262 TR3, TR5: the total result in the tone of its sign. Empty without a total; a part in another
// currency says why to assistive technology.
export function HoldingTotalCell({ holding, valueIn }: HoldingTotalCellProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const amountTone = useAmountTone();

  if (holding.totalOutside)
    return <span role="img" aria-label={t("portfolio.totalOutside")} />;
  if (holding.total === undefined) return null;

  return (
    <Text size="sm" tone={amountTone("result", directionOf(holding.total))}>
      {fmt.signed(
        { amount: holding.total, currency: valueIn },
        scale?.(valueIn) ?? 0,
      )}
    </Text>
  );
}
