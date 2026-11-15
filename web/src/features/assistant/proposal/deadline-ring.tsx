import styles from "@/features/assistant/proposal/decision-sheet.module.css";

interface DeadlineRingProps {
  // The share of the circle drawn, 0..1.
  share: number;
  // Side of the square, in px.
  size: number;
  // The ring turns while a request is in flight.
  spinning?: boolean;
}

const STROKE = 2.5;
const BOX = 16;
const RADIUS = (BOX - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// The time left of a sheet, or the wait of a running proposal. The text beside it carries the
// meaning, so the ring is hidden from assistive technology.
export function DeadlineRing({
  share,
  size,
  spinning = false,
}: DeadlineRingProps) {
  return (
    <svg
      className={spinning ? styles.ringSpin : styles.ring}
      width={size}
      height={size}
      viewBox={`0 0 ${String(BOX)} ${String(BOX)}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className={styles.ringTrack}
        cx={BOX / 2}
        cy={BOX / 2}
        r={RADIUS}
        strokeWidth={STROKE}
      />
      <circle
        className={styles.ringFill}
        cx={BOX / 2}
        cy={BOX / 2}
        r={RADIUS}
        strokeWidth={STROKE}
        strokeDasharray={`${String(share * CIRCUMFERENCE)} ${String(CIRCUMFERENCE)}`}
      />
    </svg>
  );
}
