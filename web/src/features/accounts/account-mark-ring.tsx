import styles from "@/features/accounts/account-mark.module.css";

// The ring is centred on the mark and passes 2 px beyond its box, so a neighbour in a row keeps
// its gap; the face takes the rest of the ring's width and a gap by a margin (account-mark.module.css).
// Each box is the mark's side plus 4 px; one unit is one pixel.
const rings = {
  sm: { box: 28, width: 2.5 },
  md: { box: 40, width: 3 },
  lg: { box: 52, width: 3.5 },
} as const;

export function AccountMarkRing({
  progress,
  size,
}: {
  // Basis points of a goal, 0 to 10000.
  progress: number;
  size: keyof typeof rings;
}) {
  const { box, width } = rings[size];
  const centre = box / 2;
  const radius = (box - width) / 2;
  const done = Math.min(Math.max(progress, 0), 10000) / 100;

  return (
    <svg
      className={styles.ring}
      width={box}
      height={box}
      viewBox={`0 0 ${String(box)} ${String(box)}`}
      aria-hidden="true"
    >
      <circle
        className={styles.track}
        cx={centre}
        cy={centre}
        r={radius}
        strokeWidth={width}
      />
      {done > 0 && (
        <circle
          className={styles.arc}
          cx={centre}
          cy={centre}
          r={radius}
          strokeWidth={width}
          pathLength={100}
          strokeDasharray={`${String(done)} 100`}
        />
      )}
    </svg>
  );
}
