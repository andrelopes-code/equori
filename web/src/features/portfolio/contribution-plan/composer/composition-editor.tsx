import styles from "@/features/portfolio/contribution-plan/composer/composition-editor.module.css";
import type { CompositionGroup } from "@/features/portfolio/contribution-plan/composer/composition-group";
import { ContributionBar } from "@/features/portfolio/contribution-plan/composer/contribution-bar";
import { IdealBar } from "@/features/portfolio/contribution-plan/composer/ideal-bar";
import { TodayBar } from "@/features/portfolio/contribution-plan/composer/today-bar";
import { useT } from "@/i18n/i18n-provider";

export interface CompositionEditorProps {
  groups: CompositionGroup[];
  // A preview of the contribution is loading: the contribution bar keeps the previous split.
  pending: boolean;
  state: "ok" | "noAmount" | "nameMissing";
  onTargets: (next: number[]) => void;
}

// Build-own-element. Families read: chart, which draws a plane with axes; progress-indicator, whose
// segments state one task under way; slider, which moves one value. None draws three bars of one
// scale with a draggable boundary in the first. The element draws only: the parent owns the
// targets. Every value comes from a token, the handle is a slider with arrow, Home and End keys,
// forced colors draw each segment with an edge, and nothing moves, so reduced motion changes nothing.
export function CompositionEditor({
  groups,
  pending,
  state,
  onTargets,
}: CompositionEditorProps) {
  const t = useT();

  return (
    <div className={styles.editor}>
      <span className={[styles.rowLabel, styles.tallRow].join(" ")}>
        {t("contributionPlan.barIdeal")}
      </span>
      <IdealBar groups={groups} onTargets={onTargets} />

      <span className={[styles.rowLabel, styles.thinRow].join(" ")}>
        {t("contributionPlan.barToday")}
      </span>
      <TodayBar groups={groups} />

      <span className={[styles.rowLabel, styles.thinRow].join(" ")}>
        {t("contributionPlan.barContribution")}
      </span>
      <ContributionBar groups={groups} pending={pending} state={state} />
    </div>
  );
}
