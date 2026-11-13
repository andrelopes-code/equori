import styles from "@/features/overview/attention/attention-bars.module.css";
import type { ReviewGroup } from "@/features/overview/attention/review-groups";

// CP-04 (build-own-element). Families read: progress-indicator draws one share, chart draws
// series over axes. This is the composition of one count in up to four parts, drawn as one strip.
// An image with the counts as its name; the legend beside it writes each count.
export function SegmentBar({
  groups,
  label,
}: {
  groups: readonly ReviewGroup[];
  label: string;
}) {
  return (
    <span role="img" aria-label={label} className={styles.segments}>
      {groups.map((group, i) => (
        <span
          key={i}
          className={styles.fill}
          data-segment={i}
          style={{ flex: group.count }}
        />
      ))}
    </span>
  );
}
