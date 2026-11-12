import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import { cardSectionIds } from "@/features/transactions/account-field/account-sections";
import type { Section } from "@/features/transactions/account-field/account-sections";
import { useT } from "@/i18n/i18n-provider";

import styles from "@/features/transactions/account-field/account-section-list.module.css";

interface AccountListPlaceholderProps {
  sections: Section[];
}

// The list while the balances are pending: the headings are known and drawn, each section
// reserves its real count of rows or wallet cards, and "Other accounts" stays closed. One
// region announces the wait.
export function AccountListPlaceholder({
  sections,
}: AccountListPlaceholderProps) {
  const t = useT();

  return (
    <SkeletonRegion className={styles.list}>
      {sections
        .filter((section) => section.id !== "other")
        .map((section) => (
          <div key={section.id} className={styles.section}>
            <div className={styles.heading}>
              <span>{t(section.heading)}</span>
            </div>

            <div
              className={
                cardSectionIds.has(section.id) ? styles.wall : styles.rows
              }
            >
              {section.choices.map((choice) =>
                cardSectionIds.has(section.id) ? (
                  <div key={choice.account.id} className={styles.cardShape}>
                    <Skeleton
                      shape="block"
                      blockSize="100%"
                      inlineSize="100%"
                    />
                  </div>
                ) : (
                  <Skeleton
                    key={choice.account.id}
                    shape="block"
                    blockSize={62}
                    inlineSize="100%"
                  />
                ),
              )}
            </div>
          </div>
        ))}
    </SkeletonRegion>
  );
}
