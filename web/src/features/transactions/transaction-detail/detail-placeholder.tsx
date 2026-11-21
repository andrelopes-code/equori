import { Skeleton } from "@slotted/react/skeleton";
import { Text } from "@slotted/react/typography";

import styles from "@/features/transactions/transaction-detail/transaction-detail.module.css";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

const facts: readonly MessageKey[] = [
  "facts.date",
  "facts.payee",
  "facts.description",
  "facts.tags",
  "facts.categorized",
  "facts.origin",
];

// The phone receipt while its transaction loads: the amount, one category row and the six facts,
// each in the geometry it takes once loaded (spec 2026-11-21-mobile-transaction-detail, MD7).
export function DetailPlaceholder() {
  const t = useT();

  return (
    <div data-testid="detail-placeholder" className={styles.placeholder}>
      <Skeleton shape="text">
        <Text size="3xl" weight="semibold" className={styles.amount}>
          {t("postings.amount")}
        </Text>
      </Skeleton>

      <div className={styles.placeholderRow}>
        <Skeleton shape="circle" size="md" />
        <Skeleton shape="text" inlineSize="45%" />
        <Skeleton
          shape="text"
          inlineSize="25%"
          className={styles.placeholderEnd}
        />
      </div>

      <div className={styles.placeholderFacts}>
        {facts.map((key) => (
          <div key={key} className={styles.placeholderRow}>
            <Skeleton shape="text">
              <Text size="sm">{t(key)}</Text>
            </Skeleton>
            <Skeleton
              shape="text"
              inlineSize="35%"
              className={styles.placeholderEnd}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
