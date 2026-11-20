import type { CSSProperties } from "react";

import type { AllocationData } from "@/features/assistant/view/forms/portfolio/portfolio-data";
import { useGroupLabel } from "@/features/assistant/view/forms/portfolio/use-group-label";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";

// Where the money is: one segmented bar of the groups in the theme's slots, and one row each.
export function AllocationBody({ data, unit }: FormBodyProps) {
  const format = useValueFormat();
  const label = useGroupLabel();
  const { groups } = data as AllocationData;

  const slot = (i: number) =>
    i < 8
      ? `var(--equori-slot-${String(i + 1)})`
      : "color-mix(in oklab, var(--slotted-text) 34%, transparent)";

  return (
    <>
      <div
        className={styles.stack}
        role="img"
        aria-label={groups
          .map(
            (g) => `${label(g.key)} ${valueText({ bp: g.share_bp }, format)}`,
          )
          .join(", ")}
      >
        {groups.map((g, i) => (
          <span
            key={g.key}
            className={styles.seg}
            style={{ flexGrow: g.share_bp, "--fill": slot(i) } as CSSProperties}
          />
        ))}
      </div>

      <ul className={styles.shares}>
        {groups.map((g, i) => (
          <li key={g.key} className={styles.share}>
            <i
              className={styles.key}
              style={{ "--fill": slot(i) } as CSSProperties}
            />
            <span className={styles.rowName}>{label(g.key)}</span>
            <span className={styles.num}>
              {unit === "share"
                ? valueText({ bp: g.share_bp }, format)
                : format.money(g.value)}
            </span>
            <span className={styles.sharePct}>
              {unit === "share"
                ? format.money(g.value)
                : valueText({ bp: g.share_bp }, format)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
