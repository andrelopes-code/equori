import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { initials } from "@/features/assistant/proposal/initials";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

type Item = components["schemas"]["AssistantPreviewItem"];

interface ItemRowsProps {
  items: readonly Item[];
  struck?: boolean;
}

// Families read: typography. A framed list of transactions, one 44 px row each: the initials, the
// description over its date and account, the amount at the end.
export function ItemRows({ items, struck = false }: ItemRowsProps) {
  const [locale] = useAppLocale();
  const valueText = useValueText();

  return (
    <ul className={styles.txs}>
      {items.map((item, i) => (
        <li
          key={`${item.description}-${String(i)}`}
          className={styles.tx}
          data-struck={struck}
        >
          <span className={styles.avatar} aria-hidden="true">
            {initials(item.description)}
          </span>

          <span className={styles.txText}>
            <Text size="sm" className={cx(styles.txName, styles.ellipsis)}>
              {valueText({ text: item.description })}
            </Text>
            <Text size="xs" tone="muted" className={styles.ellipsis}>
              {[
                item.date === undefined
                  ? undefined
                  : formatDayMonthNumeric(item.date, locale),
                item.account,
              ]
                .filter((part) => part !== undefined && part !== "")
                .join(" · ")}
            </Text>
          </span>

          <Text size="sm" className={styles.amount}>
            {valueText(item.amount)}
          </Text>
        </li>
      ))}
    </ul>
  );
}
