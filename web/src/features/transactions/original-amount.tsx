import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { formatRate } from "@/features/instruments";
import { ratioText } from "@/features/transactions/foreign-math";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Posting = components["schemas"]["Posting"];

// The amount in the currency the charge was made in, and the rate the booked amount implies:
// |booked| ÷ |original|. The rate stays visible while privacy hides the amounts.
export function OriginalAmount({
  posting,
  scale,
}: {
  posting: Posting;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const { original, amount } = posting;
  if (original === undefined || original.amount === 0) return null;
  const rate = ratioText(
    Math.abs(amount.amount),
    scale(amount.currency),
    Math.abs(original.amount),
    scale(original.currency),
  );
  return (
    <Stack gap={1}>
      <Text tone="muted" size="sm">
        {t("transaction.facts.original", {
          amount: fmt.money(original, scale(original.currency)),
        })}
      </Text>
      <Text tone="muted" size="sm">
        {t("transaction.facts.rate", {
          original: original.currency,
          booked: amount.currency,
          rate: formatRate(rate, tag),
        })}
      </Text>
    </Stack>
  );
}
