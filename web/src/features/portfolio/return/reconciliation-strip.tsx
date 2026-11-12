import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { reconcile } from "@/features/portfolio/return/reconciliation";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import styles from "@/ui/dialogs/detail-dialog.module.css";
import { directionOf, useAmountTone } from "@/ui/money/amount-tone";

type ReturnReport = components["schemas"]["ReturnReport"];

interface ReconciliationStripProps {
  report: ReturnReport;
}

// L3: the five figures that tie the opening balance to the closing balance, and the note of the
// flows that no sum covers.
export function ReconciliationStrip({ report }: ReconciliationStripProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const amountTone = useAmountTone();

  const { currency } = report.opening;
  const sums = reconcile(report);

  const money = (amount: number) =>
    fmt.money({ amount, currency }, scale?.(currency) ?? 0);
  const figures = [
    { label: t("portfolio.return.opening"), amount: sums.opening },
    { label: t("holdings.method.deposits"), amount: sums.deposits },
    { label: t("holdings.method.withdrawals"), amount: sums.withdrawals },
    { label: t("holdings.method.result"), amount: sums.result, tone: true },
    { label: t("portfolio.return.closing"), amount: sums.closing },
  ];

  return (
    <Stack gap={2}>
      <div
        className={styles.strip}
        role="group"
        aria-label={t("holdings.method.reconciliation")}
      >
        {figures.map((figure) => (
          <Stack
            gap={0}
            key={figure.label}
            role="group"
            aria-label={figure.label}
          >
            <Text size="xs" tone="muted">
              {figure.label}
            </Text>
            <Text
              size="lg"
              weight="semibold"
              numeric="tabular"
              tone={
                figure.tone === true
                  ? amountTone("result", directionOf(figure.amount))
                  : "inherit"
              }
            >
              {money(figure.amount)}
            </Text>
          </Stack>
        ))}
      </div>

      {sums.excluded > 0 && (
        <Text size="sm" tone="muted">
          {t("holdings.method.excluded", { count: sums.excluded })}
        </Text>
      )}
    </Stack>
  );
}
