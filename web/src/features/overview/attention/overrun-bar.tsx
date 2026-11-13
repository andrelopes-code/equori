import { overrunGeometry } from "@/features/overview/attention/overrun-geometry";
import styles from "@/features/overview/attention/attention-bars.module.css";

// CP-04 (build-own-element). Families read: progress-indicator and meter draw one value against
// one limit and cannot draw the part that passes it; chart draws a series, and this is two
// amounts of one budget. It is a picture of two figures the row writes in text, so it has no
// state, no focus and no target: an image with the values as its name.
export function OverrunBar({
  room,
  spent,
  label,
}: {
  room: number;
  spent: number;
  label: string;
}) {
  const geometry = overrunGeometry(room, spent);

  return (
    <span role="img" aria-label={label} className={styles.overrun}>
      <span
        className={styles.within}
        style={{ inlineSize: `${geometry.room.toFixed(2)}%` }}
      />
      <span
        className={styles.beyond}
        style={{
          insetInlineStart: `${geometry.room.toFixed(2)}%`,
          inlineSize: `${geometry.overrun.toFixed(2)}%`,
        }}
      />
      <span
        className={styles.mark}
        style={{ insetInlineStart: `${geometry.room.toFixed(2)}%` }}
      />
    </span>
  );
}
