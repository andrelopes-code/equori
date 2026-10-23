import styles from "@/features/setup/appearance-previews.module.css";
import { cornerScales } from "@/theme/corners";
import type { Corners } from "@/theme/corners";

const px = (value: number) => `${String(value)}px`;

// Families read: none draws a miniature of a control. A card holding a field and a button, each
// with the radius the choice gives its step: lg for the card, sm for the controls. The radii are
// the choice's own values, not tokens, so every card shows its choice and not the one in force.
export function CornersPreview({ corners }: { corners: Corners }) {
  const scale = cornerScales[corners];
  return (
    <span className={styles.corners}>
      <span className={styles.panel} style={{ borderRadius: px(scale.lg) }}>
        <span className={styles.field} style={{ borderRadius: px(scale.sm) }}>
          <span className={styles.fieldText} />
        </span>
        <span
          className={styles.button}
          style={{ borderRadius: px(scale.sm) }}
        />
      </span>
    </span>
  );
}
