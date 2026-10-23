import { goalSegments } from "@/features/goals/goal-segments";
import styles from "@/features/goals/goal-meter.module.css";

const slots = Array.from({ length: 20 }, (_, i) => i);

// The twenty-segment meter of the account card (accountCardMeter), painted with the theme's
// tokens for a goal on the card's own surface. The state is told by the tag and the figures
// beside it; the tone only repeats it.
export function GoalMeter({
  label,
  basisPoints,
  text,
}: {
  label: string;
  basisPoints: number;
  text: string;
}) {
  const filled = goalSegments(basisPoints);
  return (
    <div
      className={styles.meter}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(Math.max(basisPoints, 0), 10000) / 100}
      aria-valuetext={text}
    >
      <div className={styles.segments} aria-hidden="true">
        {slots.map((i) => (
          <span
            key={i}
            className={styles.segment}
            data-filled={i < filled || undefined}
          />
        ))}
      </div>
    </div>
  );
}
