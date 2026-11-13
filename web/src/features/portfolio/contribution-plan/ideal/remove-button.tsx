import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";

import styles from "@/features/portfolio/contribution-plan/ideal/ideal-grid.module.css";

interface RemoveButtonProps {
  label: string;
  onRemove: () => void;
}

// The last column of an edit row, on its end edge.
export function RemoveButton({ label, onRemove }: RemoveButtonProps) {
  return (
    <div className={styles.end}>
      <IconButton
        size="sm"
        variant="ghost"
        aria-label={label}
        onClick={onRemove}
      >
        <Icon>
          <Glyph name="trash" />
        </Icon>
      </IconButton>
    </div>
  );
}
