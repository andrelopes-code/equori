import styles from "@/features/setup/appearance-previews.module.css";
import type { Corners } from "@/theme/corners";

// Families read: none draws a miniature of a control. A card holding a field and a button, each
// with the radius the choice gives its step: lg for the card, sm for the controls. Each card
// scopes its own choice, so it shows that choice and not the one in force.
export function CornersPreview({ corners }: { corners: Corners }) {
  return (
    <span className={styles.corners} data-slotted-corners={corners}>
      <span className={styles.panel}>
        <span className={styles.field}>
          <span className={styles.fieldText} />
        </span>
        <span className={styles.button} />
      </span>
    </span>
  );
}
