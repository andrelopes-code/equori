import { Chart } from "@slotted/react/chart";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import styles from "@/features/accounts/account-page.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// Axis and tooltip text come from Intl options: the chart formats the number, the page never divides by a power of ten.
export function BalanceChart({
  points,
  currency,
  scale,
  loading,
  error,
  onRetry,
}: {
  points: { date: string; value: number }[];
  currency: string;
  scale: number;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  return (
    <div className={styles.chart}>
      <Chart
        data={points}
        series={[
          {
            kind: "line",
            field: "value",
            label: t("accounts.chart.series"),
            curve: "step",
            // Ledger sheet L10: accent marks forecasts; a realized balance is neutral.
            tone: "neutral",
          },
        ]}
        x={{
          field: "date",
          type: "time",
          format: { day: "numeric", month: "short" },
        }}
        y={{
          format: {
            style: "currency",
            currency,
            minimumFractionDigits: scale,
            maximumFractionDigits: scale,
          },
        }}
        title={<VisuallyHidden>{t("accounts.chart.title")}</VisuallyHidden>}
        locale={locale}
        legend={false}
        loading={loading}
        error={error}
        onRetry={onRetry}
      />
    </div>
  );
}
