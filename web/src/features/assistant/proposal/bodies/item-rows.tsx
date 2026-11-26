import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { initials } from "@/features/assistant/proposal/bodies/initials";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

type Item = components["schemas"]["AssistantPreviewItem"];

interface ItemRowsProps {
  items: readonly Item[];
  // Whether the proposal creates these transactions or touches recorded ones.
  role: "new" | "existing";
  struck?: boolean;
}

// Families read: typography. A caption that says whether the transactions are new or recorded,
// then a framed list, one 44 px row each: the initials, the description over its date and
// account, the amount at the end (spec 2026-11-15, section 7, amendment 2026-11-26).
export function ItemRows({ items, role, struck = false }: ItemRowsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const valueText = useValueText();
  const existing =
    items.length === 1
      ? t("assistant.body.items.existing.one")
      : t("assistant.body.items.existing.other", { count: items.length });
  const caption = role === "new" ? t("assistant.body.items.new") : existing;

  return (
    <div className={styles.items}>
      <Text size="xs" tone="muted">
        {caption}
      </Text>

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
    </div>
  );
}
