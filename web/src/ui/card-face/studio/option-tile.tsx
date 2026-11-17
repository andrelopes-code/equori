import type { CSSProperties, ReactNode } from "react";

import styles from "@/ui/card-face/studio/option-tile.module.css";

interface OptionTileProps {
  variant: "plastic" | "thumb" | "vis";
  group: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
  style?: CSSProperties;
  children?: ReactNode;
}

// Families read: radio-group, toggle-group, segmented-control, color-picker. None draws an option
// as a plastic, a thumbnail of the card or a drawing, so the tile is the app's own over a native
// radio: the platform gives it the name, the arrow keys and the group. The radio covers the
// tile, so the target is the whole tile (44 px or more on a phone); the focus ring, the checked
// state, forced colours and reduced motion are drawn on the tile.
export function OptionTile({
  variant,
  group,
  label,
  checked,
  onSelect,
  style,
  children,
}: OptionTileProps) {
  return (
    <label className={styles[variant]} style={style}>
      <input
        className={styles.input}
        type="radio"
        name={group}
        aria-label={label}
        checked={checked}
        onChange={onSelect}
      />

      {children}

      {variant !== "plastic" && <span className={styles.caption}>{label}</span>}
    </label>
  );
}
