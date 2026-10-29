import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/budget-plan.module.css";
import { useT } from "@/i18n/i18n-provider";

// The panel's answer while the panel is scrolled away (spec 5.2): the figure, a thin copy of
// the bar and the reference it is read against. It stops under the page's chrome (LA-06).
export function PlanStickyStrip({
  shown,
  label,
  figure,
  reference,
  over,
  bar,
}: {
  shown: boolean;
  label: string;
  figure: string;
  reference: string | undefined;
  over: boolean;
  bar: React.ReactNode;
}) {
  const t = useT();
  if (!shown) return null;
  return (
    <div className={styles.strip} aria-hidden="true">
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
  );
}
