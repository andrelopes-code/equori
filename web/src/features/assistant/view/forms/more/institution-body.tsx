import { catalogKey } from "@/features/assistant/model/catalog-key";
import type { InstitutionData } from "@/features/assistant/view/forms/more/more-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";

// Each ratio against its minimum: the bar, the minimum as a tick, the zone below it hatched.
export function InstitutionBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const { rows } = data as InstitutionData;

  const label = (kind: string) => {
    const key = catalogKey(`assistantView.institution.${kind}`);
    return key === undefined ? kind : t(key);
  };
  const scale =
    Math.max(1, ...rows.flatMap((r) => [r.value_bp, r.limit_bp ?? 0])) * 1.25;
  const pct = (bp: number) => `${String((bp / scale) * 100)}%`;

  return (
    <ul className={styles.bars}>
      {rows.map((r) => (
        <li key={r.kind} className={styles.item}>
          <div className={styles.row}>
            <span className={styles.rowKey}>
              <span className={styles.rowName}>{label(r.kind)}</span>
            </span>
            <span className={styles.rowValue}>
              {valueText({ rate: r.value_bp }, format)}
              {r.limit_bp !== undefined && (
                <small>
                  {t("assistantView.institution.minimum", {
                    value: valueText({ rate: r.limit_bp }, format),
                  })}
                </small>
              )}
            </span>
            <span className={styles.track}>
              {r.limit_bp !== undefined && (
                <i
                  className={styles.zone}
                  style={{ inlineSize: pct(r.limit_bp) }}
                />
              )}
              <i
                className={styles.fill}
                style={{ inlineSize: pct(r.value_bp) }}
              />
              {r.limit_bp !== undefined && (
                <i
                  className={styles.tick}
                  style={{ insetInlineStart: pct(r.limit_bp) }}
                />
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
