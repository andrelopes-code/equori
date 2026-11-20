import { catalogKey } from "@/features/assistant/model/catalog-key";
import type { ExplainData } from "@/features/assistant/view/forms/more/more-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";

// How each transaction got its category: the method, and the rule's pattern in the monospace font.
export function ExplainBody({ data }: FormBodyProps) {
  const t = useT();
  const { items } = data as ExplainData;

  const method = (m: string) => {
    const key = catalogKey(`assistantView.method.${m}`);
    return key === undefined ? m : t(key);
  };

  return (
    <ul className={styles.events}>
      {items.map((it) => (
        <li key={it.transaction_id} className={styles.flowRow}>
          <span className={styles.node}>
            <span className={styles.nodeKey}>
              {t("assistantView.explain.method")}
            </span>
            <span className={styles.nodeValue}>{method(it.method)}</span>
          </span>
          {it.rule_name !== undefined && it.rule_name !== "" && (
            <span className={styles.nodeHot}>
              <span className={styles.nodeKey}>
                {t("assistantView.explain.rule")}
              </span>
              <code className={styles.code}>{it.rule_name}</code>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
