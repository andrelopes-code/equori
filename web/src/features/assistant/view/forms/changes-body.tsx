import { changesRows } from "@/features/assistant/view/forms/changes-rows";
import type { ChangesData } from "@/features/assistant/view/forms/changes-rows";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";

// What changed between two periods: one diverging bar per category around a shared axis.
export function ChangesBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const rows = changesRows(data as ChangesData);

  return (
    <>
      <ul className={styles.diverge}>
        {rows.map((row) => (
          <li key={row.key} className={styles.dvRow}>
            <span className={styles.dvName}>{row.name}</span>
            <span className={styles.dvLeft}>
              {!row.rise && (
                <i style={{ inlineSize: `${String(row.width)}%` }} />
              )}
            </span>
            <span className={styles.dvAxis} />
            <span className={styles.dvRight}>
              {row.rise && (
                <i style={{ inlineSize: `${String(row.width)}%` }} />
              )}
            </span>
            <span className={styles.dvValue}>{format.delta(row.delta)}</span>
          </li>
        ))}
      </ul>

      <ul className={styles.legend}>
        <li>
          <i className={styles.keyFall} />
          {t("assistantView.changes.legend_less")}
        </li>
        <li>
          <i className={styles.keyRise} />
          {t("assistantView.changes.legend_more")}
        </li>
      </ul>
    </>
  );
}
