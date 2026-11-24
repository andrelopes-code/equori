import { Text } from "@slotted/react/typography";

import { formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { directionOf, useAmountTone } from "@/ui/money/amount-tone";

const none = "—";

interface ChangeCellProps {
  // The change of the price in basis points; null when no reference price exists (IQ5).
  bp: number | null;
  // The row is hidden: the change keeps its sign and loses its colour (A238 HD12).
  muted: boolean;
}

// A change is a percentage of a public price, so privacy mode leaves it in view (IQ9).
export function ChangeCell({ bp, muted }: ChangeCellProps) {
  const [locale] = useAppLocale();
  const amountTone = useAmountTone();

  if (bp === null)
    return (
      <Text size="sm" tone="muted">
        {none}
      </Text>
    );

  return (
    <Text
      size="sm"
      numeric="tabular"
      tone={muted ? "muted" : amountTone("result", directionOf(bp))}
    >
      {formatSignedBasisPoints(bp, locale)}
    </Text>
  );
}
