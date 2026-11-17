import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/card-face/card-face.module.css";

// The placeholder has the anatomy of the face: logo, title, chip, digits, holder and mark.
export function CardFaceSkeleton() {
  const t = useT();

  return (
    <div className={styles.box}>
      <SkeletonRegion
        className={styles.face}
        data-loading=""
        role="group"
        aria-label={t("cardFace.loading")}
        live="off"
      >
        <Skeleton className={styles.skLogo} shape="block" />
        <Skeleton className={styles.skTitle} shape="block" />
        <Skeleton className={styles.skChip} shape="block" />
        <Skeleton className={styles.skDigits} shape="block" />
        <Skeleton className={styles.skHolder} shape="block" />
        <Skeleton className={styles.skMark} shape="block" />
      </SkeletonRegion>
    </div>
  );
}
