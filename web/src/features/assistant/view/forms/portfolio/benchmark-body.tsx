import type { BenchmarkData } from "@/features/assistant/view/forms/portfolio/portfolio-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import { useT } from "@/i18n/i18n-provider";

// The period's return against its index: two bars on one scale and the difference written.
export function BenchmarkBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const d = data as BenchmarkData;

  const key = catalogKey(`assistantView.index.${d.index}`);
  const index = key === undefined ? d.index : t(key);
  const scale = Math.max(1, Math.abs(d.return_bp), Math.abs(d.index_bp));
  const width = (bp: number) => `${String((Math.max(bp, 0) / scale) * 100)}%`;

  return (
    <ul className={styles.bars}>
      <li className={styles.item}>
        <div className={styles.row}>
          <span className={styles.rowKey}>
            <span className={styles.rowName}>
              {t("assistantView.benchmark.portfolio")}
            </span>
          </span>
          <span className={styles.rowValue}>
            {valueText({ rate: d.return_bp }, format)}
          </span>
          <span className={styles.track}>
            <i
              className={styles.fill}
              style={{ inlineSize: width(d.return_bp) }}
            />
          </span>
        </div>
      </li>
      <li className={styles.item}>
        <div className={styles.row}>
          <span className={styles.rowKey}>
            <span className={styles.rowName}>{index}</span>
          </span>
          <span className={styles.rowValue}>
            {valueText({ rate: d.index_bp }, format)}
          </span>
          <span className={styles.track}>
            <i
              className={styles.fillRef}
              style={{ inlineSize: width(d.index_bp) }}
            />
          </span>
        </div>
      </li>
    </ul>
  );
}
