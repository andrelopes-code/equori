import { Link } from "@slotted/react/link";

import type { ViewUnit } from "@/features/assistant/view/view-forms";
import { RankingRowContent } from "@/features/assistant/view/forms/ranking-row-content";
import type { RankingRow as Row } from "@/features/assistant/view/forms/ranking-rows";
import { transactionsHref } from "@/features/assistant/view/forms/transactions-href";
import styles from "@/features/assistant/view/forms/forms.module.css";
import type { ViewWindow } from "@/features/assistant/view/view-types";
import { cx } from "@/ui/cx";
import { routeTo } from "@/ui/navigation/route-to";
import { useServed } from "@/ui/navigation/use-served";

interface RankingRowProps {
  row: Row;
  unit: ViewUnit;
  window: ViewWindow;
}

// One row of a ranking: a link to the category's transactions where that screen is served; the
// rest row opens nothing.
export function RankingRow({ row, unit, window }: RankingRowProps) {
  const served = useServed();

  const href = transactionsHref(row.key, window);

  if (row.rest || !served({ href })) {
    return (
      <div className={cx(styles.row, styles.restRow)}>
        <RankingRowContent row={row} unit={unit} />
      </div>
    );
  }

  return (
    <Link render={routeTo({ href })} className={styles.row}>
      <RankingRowContent row={row} unit={unit} />
    </Link>
  );
}
