import {
  lanes,
  ratioPosition,
} from "@/features/assistant/view/forms/ledger/strip-points";
import type { OutliersData } from "@/features/assistant/view/forms/ledger/view-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface OutlierStripProps {
  row: OutliersData["rows"][number];
}

// One category: its median, each purchase as a dot, the outlier ringed and named.
export function OutlierStrip({ row }: OutlierStripProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();

  const positions = row.points.map((p) => ratioPosition(p.ratio_bp));
  const offsets = lanes(positions);
  const largest = Math.max(...row.points.map((p) => p.ratio_bp));
  const ratio = numberFormatter(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const times = (bp: number) =>
    t("assistantView.outliers.times", { n: ratio.format(bp / 10000) });

  return (
    <li className={styles.strip}>
      <span className={styles.stripName}>
        {row.category}
        <small>
          {t("assistantView.outliers.median", {
            amount: format.whole(row.median, false),
          })}
        </small>
      </span>

      <span className={styles.stripTrack}>
        <i
          className={styles.med}
          style={{ insetInlineStart: `${String(ratioPosition(10000))}%` }}
        />
        {row.points.map((p, i) => (
          <span
            key={p.id}
            tabIndex={0}
            className={cx(
              styles.dot,
              row.outlier?.id === p.id && styles.dotOut,
              (positions[i] ?? 0) > 60 && styles.tipEnd,
            )}
            style={{
              insetInlineStart: `${String(positions[i])}%`,
              marginBlockStart: `${String(offsets[i])}px`,
            }}
            aria-label={`${p.name}, ${format.money(p.amount)}`}
          >
            <span className={styles.tip}>
              {t("assistantView.outliers.tip", {
                name: p.name,
                amount: format.money(p.amount),
                ratio: times(p.ratio_bp),
              })}
            </span>
          </span>
        ))}
        {row.outlier !== undefined && (
          <span
            className={styles.outLabel}
            style={{
              insetInlineStart: `${String(ratioPosition(row.outlier.ratio_bp))}%`,
            }}
          >
            {row.outlier.name}
          </span>
        )}
      </span>

      <span
        className={cx(
          styles.stripMax,
          row.outlier !== undefined && styles.stripHot,
        )}
      >
        {times(largest)}
      </span>
    </li>
  );
}
