import type { CSSProperties } from "react";

import { waterfallBars } from "@/features/assistant/view/forms/waterfall-steps";
import type { WaterfallData } from "@/features/assistant/view/forms/waterfall-steps";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

// A month as a walk: the balance at its start, income up, expense down, the other movements,
// and the balance at its end, each with its value above it.
export function WaterfallBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const bars = waterfallBars(data as WaterfallData);

  return (
    <div>
      <div
        className={styles.fall}
        style={{ "--n": bars.length } as CSSProperties}
      >
        {bars.map((bar) => (
          <span
            key={bar.kind}
            className={cx(
              styles.step,
              bar.total && styles.stepTotal,
              bar.kind === "income" && styles.stepGain,
              (bar.kind === "expense" ||
                (bar.kind === "other" && bar.amount.amount < 0)) &&
                styles.stepLoss,
            )}
            style={
              {
                "--from": `${String(bar.from)}%`,
                "--h": `${String(bar.height)}%`,
              } as CSSProperties
            }
          >
            <i />
            <b>{format.whole(bar.amount, !bar.total)}</b>
          </span>
        ))}
      </div>

      <div
        className={styles.colAxis}
        style={{ "--n": bars.length } as CSSProperties}
      >
        {bars.map((bar) => (
          <span key={bar.kind}>{t(`assistantView.waterfall.${bar.kind}`)}</span>
        ))}
      </div>
    </div>
  );
}
