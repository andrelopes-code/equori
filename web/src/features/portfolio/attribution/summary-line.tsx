import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/attribution/year-summary.module.css";
import { barSpan } from "@/features/portfolio/attribution/attribution-rows";
import {
  signTone,
  type SummaryLine as Line,
} from "@/features/portfolio/attribution/summary-figures";
import { indexName } from "@/features/calculators";
import { formatBasisPoints, formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { cx } from "@/ui/cx";

interface SummaryLineProps {
  line: Line;
  low: number;
  high: number;
  currency: string;
  scale: number;
}

// One line of the year's summary: its name, a bar of its rate on the axis shared with the other
// lines, the rate and the money. The portfolio writes its figures in the tone of their sign.
export function SummaryLine({
  line,
  low,
  high,
  currency,
  scale,
}: SummaryLineProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const own = line.kind === "portfolio";
  const span = barSpan(low, high, line.bp ?? 0);
  const window =
    line.until === undefined
      ? ""
      : t("portfolio.attribution.window", {
          day: formatDayMonthNumeric(line.until, tag),
        });
  const name = t(`portfolio.attribution.summary.${line.kind}`, {
    index: indexName(line.index ?? ""),
    window,
  });
  const loss = line.amount < 0;
  const tone = own ? signTone(line.amount) : "muted";

  return (
    <div className={cx(styles.line, own && styles.own)}>
      <Text size="sm" weight={own ? "semibold" : undefined}>
        {name}
      </Text>

      <div className={styles.track} aria-hidden="true">
        <div
          className={styles.zero}
          style={{ insetInlineStart: `${String(span.zero)}%` }}
        />
        <div
          className={cx(
            styles.bar,
            styles[line.kind],
            own && loss && styles.loss,
          )}
          style={{
            insetInlineStart: `${String(span.start)}%`,
            inlineSize: `${String(span.size)}%`,
          }}
        />
      </div>

      <Text
        size={own ? "md" : "sm"}
        weight="semibold"
        tone={tone}
        className={styles.end}
      >
        {line.bp === undefined ? "" : formatBasisPoints(line.bp, tag)}
      </Text>

      <Text size="sm" tone={tone} className={styles.end}>
        {fmt.signed({ amount: line.amount, currency }, scale)}
      </Text>
    </div>
  );
}
