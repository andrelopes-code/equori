import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import styles from "@/features/setup/market-data/market-data.module.css";

const regions = 2;
const rowsPerRegion = 3;

// A223: the surface of the pane while the feeds load. Each region reserves a flag, a title and
// three rows of a name, a detail line, a status and a switch.
export function MarketDataPlaceholder() {
  return (
    <SkeletonRegion>
      <div className={styles.surface}>
        {Array.from({ length: regions }, (_, region) => (
          <div key={region}>
            <div className={styles.placeholderHeader}>
              <Skeleton shape="block" inlineSize="2rem" blockSize="1.5rem" />
              <Skeleton shape="text" inlineSize="10rem" />
            </div>

            {Array.from({ length: rowsPerRegion }, (_, row) => (
              <div key={row} className={styles.row}>
                <div className={styles.main}>
                  <Skeleton shape="text" inlineSize="12rem" />
                  <Skeleton shape="text" inlineSize="8rem" />
                </div>
                <div className={styles.status}>
                  <Skeleton shape="text" inlineSize="4rem" />
                </div>
                <Skeleton
                  shape="block"
                  inlineSize="2.5rem"
                  blockSize="1.5rem"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
