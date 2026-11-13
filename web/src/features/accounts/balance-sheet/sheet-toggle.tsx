import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";

import styles from "@/features/accounts/balance-sheet/sheet-rail.module.css";

interface SheetToggleProps {
  open: boolean;
  label: string;
  onToggle: () => void;
}

// The button that folds or opens what stands under a parent or a positions line.
export function SheetToggle({ open, label, onToggle }: SheetToggleProps) {
  return (
    <IconButton
      aria-label={label}
      aria-expanded={open}
      variant="ghost"
      tone="secondary"
      size="sm"
      className={styles.toggle}
      onClick={onToggle}
    >
      <Icon size="sm">
        <Glyph name={open ? "chevron-down" : "chevron-right"} />
      </Icon>
    </IconButton>
  );
}
