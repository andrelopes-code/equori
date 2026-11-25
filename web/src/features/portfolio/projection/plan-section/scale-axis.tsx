import type { CSSProperties } from "react";

import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface ScaleAxisProps {
  ticks: { value: number; at: number }[];
}

// PX22: the ticks under the references, one per multiple of 5 percent a year.
export function ScaleAxis({ ticks }: ScaleAxisProps) {
  const [locale] = useAppLocale();

  const percent = numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });

  return (
    <div className={cx(styles.scaleRow, styles.scaleAxis)} aria-hidden="true">
      <span className={styles.scaleTicks}>
        {ticks.map((tick) => (
          <span
            key={tick.value}
            className={styles.scaleTick}
            style={{ "--at": tick.at } as CSSProperties}
          >
            {percent.format(tick.value / 100)}
          </span>
        ))}
      </span>
    </div>
  );
}
