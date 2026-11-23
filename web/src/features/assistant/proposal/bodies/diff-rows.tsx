import type { components } from "@/api/schema.gen";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { ChangeValue } from "@/features/assistant/proposal/bodies/change-value";
import { useChangeText } from "@/features/assistant/proposal/use-change-text";
import { useT } from "@/i18n/i18n-provider";

type Change = components["schemas"]["AssistantPreview"]["changes"][number];

interface DiffRowsProps {
  changes: readonly Change[];
}

// Each change as before → after on one row: the field, the value it replaces struck, the new value.
export function DiffRows({ changes }: DiffRowsProps) {
  const t = useT();
  const text = useChangeText();

  if (changes.length === 0) return null;

  return (
    <dl className={styles.diff}>
      {changes.map((c, i) => {
        const key = catalogKey(`assistant.field.${c.field}`);
        const before = text(c.field, c.before);
        const after = text(c.field, c.after);

        return (
          <div key={`${c.field}-${String(i)}`} className={styles.diffRow}>
            <dt className={styles.diffKey}>
              {key === undefined ? c.field : t(key)}
            </dt>
            <dd className={styles.diffValues}>
              {before !== undefined && (
                <s className={styles.was}>
                  <ChangeValue field={c.field} text={before} />
                </s>
              )}
              {before !== undefined && after !== undefined && (
                <span className={styles.diffArrow} aria-hidden="true">
                  <AssistantIcon name="link" />
                </span>
              )}
              {after !== undefined && (
                <span className={styles.is}>
                  <ChangeValue field={c.field} text={after} />
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
