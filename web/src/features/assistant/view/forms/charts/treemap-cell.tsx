import type { CSSProperties } from "react";

import { cellLabel } from "@/features/assistant/view/forms/charts/treemap-cells";
import type { TreemapData } from "@/features/assistant/view/forms/charts/treemap-cells";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface TreemapCellProps {
  cell: TreemapData["cells"][number];
  // The categorical slot of the theme, in the order of the cells.
  slot: number;
}

// One area of the treemap: its slot colour as an edge and a wash, its labels as room allows, its
// figures in a tooltip on hover and focus.
export function TreemapCell({ cell, slot }: TreemapCellProps) {
  const t = useT();
  const format = useValueFormat();

  const name = valueText(
    cell.count === undefined
      ? { text: cell.name }
      : { text: cell.name, count: cell.count },
    format,
  );
  const amount = format.money(cell.amount);
  const share = valueText({ bp: cell.share_bp }, format);
  const label = cellLabel(cell.w, cell.h);
  const style = {
    insetInlineStart: `${String(cell.x)}%`,
    insetBlockStart: `${String(cell.y)}%`,
    inlineSize: `${String(cell.w)}%`,
    blockSize: `${String(cell.h)}%`,
    "--fill": cell.rest ? undefined : `var(--equori-slot-${String(slot)})`,
  } as CSSProperties;

  return (
    <span
      className={cx(
        styles.cell,
        cell.rest && styles.restCell,
        cell.x + cell.w / 2 > 50 && styles.tipEnd,
      )}
      style={style}
      tabIndex={0}
      aria-label={`${name}, ${amount}, ${share}`}
    >
      {label === "full" && (
        <>
          <span className={styles.cellName}>{name}</span>
          <span className={styles.cellValue}>{amount}</span>
          <span className={styles.cellShare}>{share}</span>
        </>
      )}
      {label === "share" && <span className={styles.cellShare}>{share}</span>}
      <span className={styles.tip}>
        {t("assistantView.cell_tip", { name, amount, share })}
      </span>
    </span>
  );
}
