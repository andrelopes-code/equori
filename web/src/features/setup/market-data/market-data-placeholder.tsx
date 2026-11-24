import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import { Text } from "@slotted/react/typography";

import styles from "@/features/setup/market-data/market-data.module.css";

// The two open regions of the loaded pane, each with the widths of its title, its line and the
// name and detail of its rows, so the lines vary as the text does.
const regions = [
  {
    title: "5rem",
    line: "9rem",
    rows: [
      { name: "7rem", detail: "16rem" },
      { name: "10rem", detail: "13rem" },
      { name: "6rem", detail: "18rem" },
    ],
  },
  {
    title: "4rem",
    line: "14rem",
    rows: [
      { name: "9rem", detail: "15rem" },
      { name: "6rem", detail: "12rem" },
      { name: "8rem", detail: "17rem" },
    ],
  },
];

// A223: the surface of the pane while the feeds load. Each region is the band and the rows of the
// loaded pane (region-band.tsx, market-data-feed-row.tsx) with the text and the switch reserved.
export function MarketDataPlaceholder() {
  return (
    <SkeletonRegion>
      <div className={styles.surface}>
        {regions.map((region) => (
          <div key={region.title}>
            <div className={styles.band}>
              <span className={styles.bandTitle}>
                <Skeleton shape="block" inlineSize="2rem" blockSize="1.5rem" />

                <span className={styles.bandText}>
                  <span className={styles.bandName}>
                    <Skeleton shape="text" inlineSize={region.title} />
                  </span>
                  <span className={styles.bandLine}>
                    <Skeleton shape="text" inlineSize={region.line} />
                  </span>
                </span>
              </span>
            </div>

            {region.rows.map((row) => (
              <div key={row.name} className={styles.row}>
                <div className={styles.main}>
                  <Text size="md" className={styles.line}>
                    <Skeleton shape="text" inlineSize={row.name} />
                  </Text>
                  <Text size="sm" className={styles.line}>
                    <Skeleton shape="text" inlineSize={row.detail} />
                  </Text>
                </div>

                <div className={styles.status}>
                  <Text size="sm">
                    <Skeleton shape="text" inlineSize="4.5rem" />
                  </Text>
                  <Text size="sm">
                    <Skeleton shape="text" inlineSize="3.5rem" />
                  </Text>
                </div>

                <span className={styles.mark} />

                <Skeleton
                  className={styles.toggle}
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
