import { TreemapCell } from "@/features/assistant/view/forms/treemap-cell";
import type { TreemapData } from "@/features/assistant/view/forms/treemap-cells";
import styles from "@/features/assistant/view/forms/forms.module.css";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";

// Where the money went, as areas: each category's area is its share; the rest is neutral and last.
export function TreemapBody({ data }: FormBodyProps) {
  const tree = data as TreemapData;

  return (
    <div className={styles.tree}>
      {tree.cells.map((cell, index) => (
        <TreemapCell
          key={cell.account_id ?? "rest"}
          cell={cell}
          slot={index + 1}
        />
      ))}
    </div>
  );
}
