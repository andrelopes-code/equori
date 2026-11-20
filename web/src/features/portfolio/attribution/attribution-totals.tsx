import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/attribution/attribution.module.css";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { cx } from "@/ui/cx";

type AttributionYear = components["schemas"]["AttributionYear"];

interface AttributionTotalsProps {
  year: AttributionYear;
  scale: number;
}

// The rest of the result that no holding owns, when there is any, then the portfolio with the
// time-weighted rate of "Como rendeu" for the same days (AT3).
export function AttributionTotals({ year, scale }: AttributionTotalsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  if (year.result === undefined) return null;

  const other = year.other;

  return (
    <>
      {other !== undefined && other.amount !== 0 && (
        <div role="listitem" className={styles.row} data-attribution="other">
          <Text size="sm">{t("portfolio.attribution.other")}</Text>
          <span />
          <Text size="sm" className={styles.end}>
            {fmt.signed(other, scale)}
          </Text>
          <span />
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
          {fmt.signed(year.result, scale)}
        </Text>
        <Text size="sm" weight="semibold" className={styles.end}>
          {year.period_bp === undefined
            ? ""
            : formatBasisPoints(year.period_bp, tag)}
        </Text>
      </div>
    </>
  );
}
