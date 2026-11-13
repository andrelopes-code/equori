import styles from "@/features/portfolio/contribution-plan/composer/composition-editor.module.css";
import { useSegmentLabel } from "@/features/portfolio/contribution-plan/composer/use-segment-label";

interface ContributionLabelProps {
  text: string;
  weight: number;
  barWidth: number;
}

// The amount under one segment of the contribution bar; it is drawn only where it fits.
export function ContributionLabel({
  text,
  weight,
  barWidth,
}: ContributionLabelProps) {
  const { label, room, full } = useSegmentLabel(
    [barWidth, weight, text].join("|"),
  );

  return (
    <div className={styles.labelCell} style={{ flexGrow: weight }}>
      <span data-measure="room" ref={room} className={styles.amountRoom}>
        {label === "none" ? "" : text}
      </span>

      <span data-measure="full" ref={full} className={styles.measure}>
        {text}
      </span>
    </div>
  );
}
