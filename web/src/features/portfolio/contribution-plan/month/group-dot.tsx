import styles from "@/features/portfolio/contribution-plan/month/group-dot.module.css";

interface GroupDotProps {
  // The position of the group in the plan; it picks the colour of the data palette.
  position: number;
}

const paletteSize = 8;

// Build-own-element: no family draws a colour mark that names a group. It repeats the group name
// beside it, so it is hidden from assistive technology.
export function GroupDot({ position }: GroupDotProps) {
  const slot = styles[`slot${String((position % paletteSize) + 1)}`];

  return <span aria-hidden="true" className={[styles.dot, slot].join(" ")} />;
}
