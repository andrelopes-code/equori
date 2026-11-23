import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import styles from "@/features/planning/budget-plan/budget-plan.module.css";
import { PlanReferencePanel } from "@/features/planning/budget-plan/plan-reference-panel";
import { PlanStickyStrip } from "@/features/planning/budget-plan/plan-sticky-strip";
import type { usePlanDraft } from "@/features/planning/budget-plan/use-plan-draft";
import type { usePlanFigures } from "@/features/planning/budget-plan/use-plan-figures";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { useT } from "@/i18n/i18n-provider";
import { useVisible } from "@/ui/runtime/use-visible";

interface PlanAnswerProps {
  plan: components["schemas"]["BudgetPlan"];
  draft: ReturnType<typeof usePlanDraft>;
  figures: ReturnType<typeof usePlanFigures>;
  format: PlanFormat;
  editable: boolean;
  bar: ReactNode;
}

// The plan's answer in its two places: the panel, and the strip that takes over while the panel
// is scrolled away (budget plan spec 5.2). Both follow one state, so one leaves as the other
// arrives.
export function PlanAnswer({
  plan,
  draft,
  figures,
  format,
  editable,
  bar,
}: PlanAnswerProps) {
  const t = useT();
  const [panelRef, panelVisible] = useVisible();

  const { reference, over } = figures;

  return (
    <>
      <PlanStickyStrip
        shown={!panelVisible}
        label={over ? t("plan.over") : t("plan.unassigned")}
        figure={figures.figure}
        reference={
          reference === undefined ? undefined : format.money(reference)
        }
        over={over}
        bar={bar}
      />

      <div
        className={styles.panelHolder}
        data-away={panelVisible ? undefined : ""}
      >
        <div ref={panelRef} className={styles.panelProbe} />
        <PlanReferencePanel
          plan={plan}
          source={draft.source}
          fixed={draft.fixed}
          reference={reference}
          unassigned={figures.unassigned}
          committed={figures.committed}
          format={format}
          editable={editable}
          bar={bar}
          target={draft.target}
          onSource={(source, fixed) => {
            draft.setSource(source, fixed);
          }}
          onTarget={(bp) => {
            draft.setTarget(bp);
          }}
        />
      </div>
    </>
  );
}
