import type { ViewUnit } from "@/features/assistant/view/view-forms";
import type { RankingRow } from "@/features/assistant/view/forms/bars/ranking-rows";
import { RowValue } from "@/features/assistant/view/forms/bars/row-value";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface RankingRowContentProps {
  row: RankingRow;
  unit: ViewUnit;
}

// The name, the value and the bar of a ranking row.
export function RankingRowContent({ row, unit }: RankingRowContentProps) {
  const t = useT();

  const name = row.rest
    ? t("assistantView.ranking.rest", { count: String(row.count ?? 0) })
    : row.name;

  return (
    <>
      <span className={styles.rowKey}>
        <span className={styles.rank}>{row.rank}</span>
        <span className={styles.rowName}>{name}</span>
      </span>

      <RowValue amount={row.amount} shareBp={row.shareBp} unit={unit} />

      <span className={styles.track}>
        <i
          className={cx(styles.fill, row.rest && styles.neutral)}
          style={{ inlineSize: `${String(row.width)}%` }}
        />
      </span>
    </>
  );
}
