import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";
import type { NavigateOptions } from "@tanstack/react-router";

import styles from "@/features/overview/attention/attention-bars.module.css";
import { routeTo } from "@/ui/navigation/route-to";
import { useServed } from "@/ui/navigation/use-served";

export interface ReviewLegendEntry {
  label: string;
  count: string;
  to: NavigateOptions;
}

// One line per source, in the order of the bar: the swatch repeats the ground and the hatching of
// the bar's cell, the name links to where the source is resolved, and the counts end on one line.
export function ReviewLegend({
  entries,
}: {
  entries: readonly ReviewLegendEntry[];
}) {
  const served = useServed();

  return (
    <span className={styles.legend}>
      {entries.map((entry, i) => (
        <span key={entry.label} className={styles.legendRow}>
          <Text size="sm" tone="muted" className={styles.legendLabel}>
            <span
              className={[styles.fill, styles.swatch].join(" ")}
              data-segment={i}
            />

            {served(entry.to) ? (
              <Link render={routeTo(entry.to)}>{entry.label}</Link>
            ) : (
              entry.label
            )}
          </Text>

          <Text size="sm" tone="muted" numeric="tabular">
            {entry.count}
          </Text>
        </span>
      ))}
    </span>
  );
}
