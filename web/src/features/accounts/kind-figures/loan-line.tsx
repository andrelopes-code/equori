import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useLoanFigures } from "@/features/accounts/kind-figures/use-loan-figures";
import { formatReferenceMonth, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface LoanLineProps {
  account: Account;
}

// K10: a loan's status in the list, its repaid share and the month its schedule ends.
export function LoanLine({ account }: LoanLineProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const { figures, remaining } = useLoanFigures(account);

  if (figures?.fraction === undefined) return null;

  const percent = numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(figures.fraction);

  return (
    <Text size="xs" tone="muted" wrap="nowrap">
      {remaining === undefined
        ? t("loan.lineNoEnd", { percent })
        : t("loan.line", {
            percent,
            month: formatReferenceMonth(remaining.last.slice(0, 7), locale),
          })}
    </Text>
  );
}
