import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/attribution/attribution.module.css";
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

// One holding, or the sum of the others: name, a bar on the axis centred on zero (none for the
// others), the result and the rate. A stale holding writes the date of its quote where the bar and the rate stand (AT5).
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

  const span = barSpan(low, high, row.result);
  const name =
    row.instrument ??
    t(
      row.others === 1
        ? "portfolio.attribution.others.one"
        : "portfolio.attribution.others.other",
      { count: String(row.others ?? 0) },
    );
  const tone = row.result < 0 ? styles.loss : styles.gain;
  const bar = row.staleSince === undefined && row.others === undefined;

  return (
    <div role="listitem" className={styles.row} data-attribution={row.key}>
      <Text
        size="sm"
        weight={row.instrument === undefined ? undefined : "medium"}
      >
        {name}
      </Text>

      {row.staleSince !== undefined && (
        <Text size="sm" tone="warning" className={styles.stale}>
          {t("portfolio.attribution.stale", {
            date: formatDate(row.staleSince, tag),
          })}
        </Text>
      )}

      {row.others !== undefined && <span />}

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

      <Text size="sm" className={styles.end}>
        {fmt.signed({ amount: row.result, currency }, scale)}
      </Text>

      <Text size="sm" tone="muted" className={styles.end}>
        {row.returnBp === undefined ? "" : formatBasisPoints(row.returnBp, tag)}
      </Text>
    </div>
  );
}
