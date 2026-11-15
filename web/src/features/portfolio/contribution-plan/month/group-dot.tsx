import styles from "@/features/portfolio/contribution-plan/month/group-dot.module.css";

interface GroupDotProps {
  // The position of the group in the plan; it picks the colour of the data palette. Without it
  // the mark is the hatched leftover.
  position?: number;
  shape?: "dot" | "square";
}

const paletteSize = 8;

// Build-own-element: no family draws a colour mark that names a group. It repeats the group name
// beside it, so it is hidden from assistive technology.
export function GroupDot({ position, shape = "dot" }: GroupDotProps) {
  const fill =
    position === undefined
      ? styles.hatch
      : styles[`slot${String((position % paletteSize) + 1)}`];
  const corner = shape === "square" ? styles.square : undefined;

  return (
    <span
      aria-hidden="true"
      className={[styles.dot, corner, fill].filter(Boolean).join(" ")}
    />
  );
}
