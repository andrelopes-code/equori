import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import styles from "@/features/spreadsheets/editor/spreadsheet-placeholder.module.css";
import { useT } from "@/i18n/i18n-provider";

// The editor's anatomy while it loads: the toolbar, the grid and the sheet tabs. It covers the
// editor until the grid is drawn, so the placeholder Univer draws of its own is never seen.
export function SpreadsheetPlaceholder() {
  const t = useT();

  return (
    <SkeletonRegion
      className={styles.placeholder}
      messages={{ label: t("spreadsheets.loading") }}
    >
      <div className={styles.toolbar}>
        <Skeleton shape="block" inlineSize="6rem" blockSize="1rem" />
        <Skeleton
          className={styles.tools}
          shape="block"
          inlineSize="1.5rem"
          blockSize="1.5rem"
        />
        <Skeleton shape="block" inlineSize="1.5rem" blockSize="1.5rem" />
      </div>

      <div className={styles.grid}>
        <Skeleton shape="block" inlineSize="33%" blockSize="1rem" />
        <Skeleton className={styles.cells} shape="block" />
      </div>

      <div className={styles.tabs}>
        <div className={styles.group}>
          <Skeleton shape="block" inlineSize="1.25rem" blockSize="1.25rem" />
          <Skeleton shape="block" inlineSize="3.5rem" blockSize="1.25rem" />
        </div>

        <div className={styles.group}>
          <Skeleton shape="block" inlineSize="1.25rem" blockSize="1.25rem" />
          <Skeleton shape="block" inlineSize="6rem" blockSize="0.5rem" />
          <Skeleton shape="block" inlineSize="1.25rem" blockSize="1.25rem" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
