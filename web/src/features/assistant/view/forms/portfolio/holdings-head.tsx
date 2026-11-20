import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import type { HoldingsKey } from "@/features/assistant/view/forms/portfolio/sort-holdings";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useT } from "@/i18n/i18n-provider";

interface HoldingsHeadProps {
  sorted: HoldingsKey;
  onSort: (key: HoldingsKey) => void;
}

const COLUMNS: readonly HoldingsKey[] = ["value", "result", "weight"];

// The head of the holdings table: the instrument, then three columns that sort the rows.
export function HoldingsHead({ sorted, onSort }: HoldingsHeadProps) {
  const t = useT();

  return (
    <thead>
      <tr>
        <th>{t("assistantView.col.instrument")}</th>
        {COLUMNS.map((c) => (
          <th key={c} aria-sort={sorted === c ? "descending" : "none"}>
            <button
              type="button"
              className={styles.sort}
              onClick={() => {
                onSort(c);
              }}
            >
              {t(`assistantView.col.${c}`)}
              <span className={styles.icon12}>
                <AssistantIcon name="chevron" />
              </span>
            </button>
          </th>
        ))}
      </tr>
    </thead>
  );
}
