import type { components } from "@/api/schema.gen";
import styles from "@/features/transactions/capture-segments.module.css";

type Segment = components["schemas"]["CaptureSegment"];

// The line as the owner wrote it, each part marked with what it was read as (A107). The
// marks are decoration: the draft beside it states every value in words.
export function CaptureSegments({
  segments,
}: {
  segments: readonly Segment[];
}) {
  return (
    <p className={styles.line}>
      {segments.map((s, i) =>
        s.role === "text" ? (
          s.text
        ) : (
          <mark
            // Segments have no identity of their own; their order is the line's.
            key={i}
            className={styles.part}
            data-role={s.role}
          >
            {s.text}
          </mark>
        ),
      )}
    </p>
  );
}
