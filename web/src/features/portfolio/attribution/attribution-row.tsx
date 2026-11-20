import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/attribution/attribution.module.css";
import { pointsText } from "@/features/portfolio/attribution/attribution-points";
import {
  barSpan,
  type AttributionRow as Row,
} from "@/features/portfolio/attribution/attribution-rows";
import { formatBasisPoints, formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { cx } from "@/ui/cx";

interface AttributionRowProps {
  row: Row;
  low: number;
  high: number;
  currency: string;
  scale: number;
}

// One holding, or the sum of the others: name, a bar of its contribution on an axis centred on
// zero (none for the others), weight, rate, contribution and result. A stale holding writes the
// date of its quote where the bar stands and has no rate (AT5).
export function AttributionRow({
  row,
  low,
  high,
  currency,
  scale,
}: AttributionRowProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const span = barSpan(low, high, row.contributionBp);
  const name =
    row.instrument ??
    t(
      row.others === 1
        ? "portfolio.attribution.others.one"
        : "portfolio.attribution.others.other",
      { count: String(row.others ?? 0) },
    );
  const tone = row.contributionBp < 0 ? styles.loss : styles.gain;
  const bar = row.staleSince === undefined && row.others === undefined;

  return (
    <div role="listitem" className={styles.row} data-attribution={row.key}>
      <Text
        size="sm"
        weight={row.instrument === undefined ? undefined : "medium"}
      >
        {name}
      </Text>

      {row.others !== undefined && <span />}

      {row.staleSince !== undefined && (
        <Text size="sm" tone="warning" className={styles.stale}>
          {t("portfolio.attribution.stale", {
            date: formatDate(row.staleSince, tag),
          })}
        </Text>
      )}

      {bar && (
        <div className={styles.track} aria-hidden="true">
          <div
            className={styles.zero}
            style={{ insetInlineStart: `${String(span.zero)}%` }}
          />
          <div
            className={cx(styles.bar, tone)}
            style={{
              insetInlineStart: `${String(span.start)}%`,
              inlineSize: `${String(span.size)}%`,
            }}
          />
        </div>
      )}

      <Text size="sm" tone="muted" className={styles.end}>
        {formatBasisPoints(row.weightBp, tag)}
      </Text>

      <Text size="sm" tone="muted" className={styles.end}>
        {row.returnBp === undefined ? "" : formatBasisPoints(row.returnBp, tag)}
      </Text>

      <Text size="sm" className={styles.end}>
        {pointsText(row.contributionBp, tag, t)}
      </Text>

      <Text size="sm" className={styles.end}>
        {fmt.signed({ amount: row.result, currency }, scale)}
      </Text>
    </div>
  );
}
