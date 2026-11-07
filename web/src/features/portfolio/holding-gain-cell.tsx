import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import type { Holding } from "@/features/portfolio/portfolio-holdings";
import { useScale } from "@/features/setup";
import { formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface HoldingGainCellProps {
  holding: Holding;
  valueIn: string;
}

function toneOf(gain: number) {
  if (gain > 0) return "success";

  return gain < 0 ? "danger" : "default";
}

// PC7: the gain in money, in the tone of its sign, and in percent of the cost. Empty for cash and
// for a row without a price; a mixed row says why to assistive technology.
export function HoldingGainCell({ holding, valueIn }: HoldingGainCellProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  if (holding.mixed)
    return <span role="img" aria-label={t("portfolio.resultMixed")} />;
  if (holding.gain === undefined) return null;

  return (
    <Inline gap={2} align="center" justify="end" wrap="nowrap">
      <Text size="sm" tone={toneOf(holding.gain)}>
        {fmt.signed(
          { amount: holding.gain, currency: valueIn },
          scale?.(valueIn) ?? 0,
        )}
      </Text>
      {holding.gainBp !== undefined && (
        <Text size="sm" tone="muted">
          {formatSignedBasisPoints(holding.gainBp, tag)}
        </Text>
      )}
    </Inline>
  );
}
