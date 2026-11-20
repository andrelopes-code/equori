import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/attribution/attribution.module.css";
import { attributionLead } from "@/features/portfolio/attribution/attribution-lead";
import { AttributionRow } from "@/features/portfolio/attribution/attribution-row";
import { attributionFigures } from "@/features/portfolio/attribution/attribution-rows";
import { AttributionTotals } from "@/features/portfolio/attribution/attribution-totals";
import { indexName } from "@/features/calculators";
import { useScale } from "@/features/setup";
import { formatBasisPoints, formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { cx } from "@/ui/cx";

type AttributionYear = components["schemas"]["AttributionYear"];

interface AttributionYearViewProps {
  year: AttributionYear;
}

// The year: what the portfolio made, how it stands beside the CDI and the IPCA, how many holdings
// added and took away, one row per holding in the order of AT7, then the rest and the portfolio.
export function AttributionYearView({ year }: AttributionYearViewProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const currency = year.result?.currency ?? "";
  const digits = scale?.(currency) ?? 0;
  const figures = attributionFigures(year.items ?? []);
  const text = attributionLead(year, figures.gains, figures.losses, t, {
    money: (amount) => fmt.money({ amount, currency }, digits),
    percent: (bp) => formatBasisPoints(bp, tag),
    dayMonth: (iso) => formatDayMonthNumeric(iso, tag),
    indexName,
  });

  if (year.missing !== undefined) {
    return (
      <Text size="sm" tone="muted">
        {year.missing.length === 0
          ? t("portfolio.attribution.unpriced")
          : t("portfolio.attribution.missing", {
              codes: year.missing.join(", "),
            })}
      </Text>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.lead}>
        <Text weight="semibold">{text.lead}</Text>
        {text.compare !== undefined && <Text size="sm">{text.compare}</Text>}
        {text.tally !== undefined && (
          <Text size="sm" tone="muted">
            {text.tally}
          </Text>
        )}
      </div>

      <div
        role="list"
        className={styles.rows}
        aria-label={t("portfolio.attribution.rows", { period: text.period })}
      >
        <div className={cx(styles.row, styles.head)} aria-hidden="true">
          <Text size="xs" tone="muted">
            {t("portfolio.attribution.col.holding")}
          </Text>
          <span />
          <Text size="xs" tone="muted" className={styles.end}>
            {t("portfolio.attribution.col.weight")}
          </Text>
          <Text size="xs" tone="muted" className={styles.end}>
            {t("portfolio.attribution.col.rate")}
          </Text>
          <Text size="xs" tone="muted" className={styles.end}>
            {t("portfolio.attribution.col.contribution")}
          </Text>
          <Text size="xs" tone="muted" className={styles.end}>
            {t("portfolio.attribution.col.result")}
          </Text>
        </div>

        {figures.rows.map((row) => (
          <AttributionRow
            key={row.key}
            row={row}
            low={figures.low}
            high={figures.high}
            currency={currency}
            scale={digits}
          />
        ))}

        <AttributionTotals year={year} scale={digits} />
      </div>
    </div>
  );
}
