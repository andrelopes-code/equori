import { OutlierStrip } from "@/features/assistant/view/forms/ledger/outlier-strip";
import { ratioPosition } from "@/features/assistant/view/forms/ledger/strip-points";
import type { OutliersData } from "@/features/assistant/view/forms/ledger/view-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";

// Each purchase of a category as a dot in multiples of the category's median, on a log axis.
export function OutliersBody({ data }: FormBodyProps) {
  const t = useT();
  const { rows } = data as OutliersData;

  return (
    <div>
      <ul className={styles.strips}>
        {rows.map((row) => (
          <OutlierStrip key={row.category} row={row} />
        ))}
      </ul>

      <div className={styles.stripAxis}>
        <span style={{ insetInlineStart: "0%" }}>
          {t("assistantView.outliers.axis_low")}
        </span>
        <span style={{ insetInlineStart: `${String(ratioPosition(10000))}%` }}>
          {t("assistantView.outliers.axis_median")}
        </span>
        <span style={{ insetInlineStart: `${String(ratioPosition(100000))}%` }}>
          {t("assistantView.outliers.axis_high")}
        </span>
      </div>
    </div>
  );
}
