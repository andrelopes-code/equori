import type { CSSProperties } from "react";

import { slot } from "@/features/assistant/view/forms/more/slot";
import styles from "@/features/assistant/view/forms/forms.module.css";

interface ShareListProps {
  label: string;
  items: {
    key: string;
    name: string;
    value: string;
    share: string;
    weight: number;
  }[];
}

// A composition: one segmented bar in the theme's slots and one row per part with value and share.
export function ShareList({ label, items }: ShareListProps) {
  return (
    <>
      <div className={styles.stack} role="img" aria-label={label}>
        {items.map((it, i) => (
          <span
            key={it.key}
            className={styles.seg}
            style={
              {
                flexGrow: Math.max(it.weight, 1),
                "--fill": slot(i),
              } as CSSProperties
            }
          />
        ))}
      </div>

      <ul className={styles.shares}>
        {items.map((it, i) => (
          <li key={it.key} className={styles.share}>
            <i
              className={styles.key}
              style={{ "--fill": slot(i) } as CSSProperties}
            />
            <span className={styles.rowName}>{it.name}</span>
            <span className={styles.num}>{it.value}</span>
            <span className={styles.sharePct}>{it.share}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
