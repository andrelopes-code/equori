import type { ReactNode } from "react";

import styles from "@/features/transactions/transaction-filter-bar.module.css";
import { useT } from "@/i18n/i18n-provider";

export interface FilterWordTrigger {
  className: string;
  children: string;
}

// One filter of the row: a text button that reads the filter name, or "Name: value" while the
// filter holds a value, with a remove button beside it. The trigger is the caller's element.
export function FilterWord({
  name,
  value,
  onRemove,
  trigger,
}: {
  name: string;
  value: string | undefined;
  onRemove: () => void;
  trigger: (word: FilterWordTrigger) => ReactNode;
}) {
  const t = useT();
  const active = value !== undefined;
  return (
    <span className={styles.word} data-active={active ? "" : undefined}>
      {trigger({
        className: styles.trigger ?? "",
        children: active
          ? t("transactions.filter.active", { name, value })
          : name,
      })}
      {active && (
        <button
          type="button"
          className={styles.remove}
          aria-label={t("transactions.filter.remove", { name })}
          onClick={onRemove}
        />
      )}
    </span>
  );
}
