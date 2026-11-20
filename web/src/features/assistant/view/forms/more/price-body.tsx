import { sparkPath } from "@/features/assistant/view/forms/charts/spark-path";
import type { PriceData } from "@/features/assistant/view/forms/more/more-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { formatDate } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";

// Prices over the period as a line, its range at the side and its dates below.
export function PriceBody({ data }: FormBodyProps) {
  const [locale] = useAppLocale();
  const d = data as PriceData;

  const values = d.points.map((p) => Number(p.value));
  const first = d.points[0];
  const last = d.points.at(-1);

  return (
    <div>
      <div className={styles.canvas}>
        <svg
          className={styles.priceLine}
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={sparkPath(values)} />
        </svg>
      </div>
      {first !== undefined && last !== undefined && (
        <div className={styles.xAxis}>
          <span>{formatDate(first.date, locale)}</span>
          <span>{formatDate(last.date, locale)}</span>
        </div>
      )}
    </div>
  );
}
