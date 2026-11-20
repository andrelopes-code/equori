import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { RankingRow } from "@/features/assistant/view/forms/ranking-row";
import { rankingRows } from "@/features/assistant/view/forms/ranking-rows";
import type { RankingData } from "@/features/assistant/view/forms/ranking-rows";
import styles from "@/features/assistant/view/forms/forms.module.css";

// A ranking: bars in order against the largest; the rest folds into one neutral row.
export function RankingBody({ data, unit, window }: FormBodyProps) {
  const rows = rankingRows(data as RankingData);

  return (
    <ul className={styles.bars}>
      {rows.map((row) => (
        <li key={row.key} className={styles.item}>
          <RankingRow row={row} unit={unit} window={window} />
        </li>
      ))}
    </ul>
  );
}
