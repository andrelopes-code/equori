import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import styles from "@/features/cards/card-tile/statement-ticket.module.css";
import { useT } from "@/i18n/i18n-provider";

// The closed ticket's shape: the word, the amount and the limit bar.
export function TicketSkeleton() {
  const t = useT();

  return (
    // The cards of a page load together; the page, not each card, reports the wait.
    <SkeletonRegion
      className={styles.ticket}
      role="group"
      aria-label={t("cards.loading")}
      live="off"
    >
      <Skeleton inlineSize={96} blockSize={10} />
      <Skeleton inlineSize={160} blockSize={26} />
      <Skeleton blockSize={8} />
    </SkeletonRegion>
  );
}
