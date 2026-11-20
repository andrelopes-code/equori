import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/attribution/attribution.module.css";
import { pointsText } from "@/features/portfolio/attribution/attribution-points";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { cx } from "@/ui/cx";

type AttributionYear = components["schemas"]["AttributionYear"];

interface AttributionTotalsProps {
  year: AttributionYear;
  scale: number;
}

// The share no holding owns (cash, fees, exchange) when it weighs or adds anything, then the
// portfolio: 100% of the capital, its return as rate and as contribution, and its result (AT8, AT9).
export function AttributionTotals({ year, scale }: AttributionTotalsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  if (year.result === undefined) return null;

  const other = year.other;
  const showOther =
    other !== undefined && (other.weight_bp !== 0 || other.result.amount !== 0);
  const rate =
    year.return_bp === undefined ? "" : formatBasisPoints(year.return_bp, tag);

  return (
    <>
      {showOther && (
        <div role="listitem" className={styles.row} data-attribution="other">
          <Text size="sm">{t("portfolio.attribution.other")}</Text>
          <span />
          <Text size="sm" tone="muted" className={styles.end}>
            {formatBasisPoints(other.weight_bp, tag)}
          </Text>
          <Text size="sm" tone="muted" className={styles.end}>
            {other.return_bp === undefined
              ? ""
              : formatBasisPoints(other.return_bp, tag)}
          </Text>
          <Text size="sm" className={styles.end}>
            {pointsText(other.contribution_bp, tag, t)}
          </Text>
          <Text size="sm" className={styles.end}>
            {fmt.signed(other.result, scale)}
          </Text>
        </div>
      )}

      <div
        role="listitem"
        className={cx(styles.row, styles.total)}
        data-attribution="total"
      >
        <Text size="sm" weight="semibold">
          {t("portfolio.attribution.total")}
        </Text>
        <span />
        <Text size="sm" weight="semibold" className={styles.end}>
          {formatBasisPoints(10000, tag)}
        </Text>
        <Text size="sm" weight="semibold" className={styles.end}>
          {rate}
        </Text>
        <Text size="sm" weight="semibold" className={styles.end}>
          {year.return_bp === undefined
            ? ""
            : pointsText(year.return_bp, tag, t)}
        </Text>
        <Text size="sm" weight="semibold" className={styles.end}>
          {fmt.signed(year.result, scale)}
        </Text>
      </div>
    </>
  );
}
