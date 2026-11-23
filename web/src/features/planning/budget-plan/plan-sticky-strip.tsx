import { Text } from "@slotted/react/typography";
import { useState } from "react";
import type { ReactNode } from "react";

import styles from "@/features/planning/budget-plan/budget-plan.module.css";
import { useT } from "@/i18n/i18n-provider";

interface PlanStickyStripProps {
  shown: boolean;
  label: string;
  figure: string;
  reference: string | undefined;
  over: boolean;
  bar: ReactNode;
}

// The panel's answer while the panel is scrolled away (spec 5.2): the figure, a thin copy of
// the bar and the reference it is read against. It stops under the page's chrome (LA-06). From
// its first showing on it stays rendered, hidden, so it plays its exit.
export function PlanStickyStrip({
  shown,
  label,
  figure,
  reference,
  over,
  bar,
}: PlanStickyStripProps) {
  const t = useT();

  const [seen, setSeen] = useState(shown);

  if (shown && !seen) setSeen(true);

  if (!shown && !seen) return null;

  return (
    <div className={styles.stripHolder}>
      <div
        className={styles.strip}
        aria-hidden="true"
        data-shown={shown ? "" : undefined}
      >
        <div className={styles.stripFigure}>
          <Text size="xs" tone="muted">
            {label}
          </Text>
          <Text
            size="md"
            weight="semibold"
            numeric="tabular"
            tone={over ? "danger" : "default"}
          >
            {figure}
          </Text>
        </div>

        <div className={styles.stripBar}>{bar}</div>

        {reference !== undefined && (
          <Text size="xs" tone="muted" numeric="tabular">
            {t("plan.ofReference", { amount: reference })}
          </Text>
        )}
      </div>
    </div>
  );
}
