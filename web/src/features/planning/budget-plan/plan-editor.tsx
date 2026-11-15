import { Stack } from "@slotted/react/stack";
import { useState } from "react";
import type { KeyboardEvent } from "react";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import styles from "@/features/planning/budget-plan/budget-plan.module.css";
import { PlanAllocationBar } from "@/features/planning/budget-plan/plan-allocation-bar";
import { planShortcut } from "@/features/planning/budget-plan/plan-keys";
import { PlanBuckets } from "@/features/planning/income-split/plan-buckets";
import { PlanAnnouncer } from "@/features/planning/budget-plan/plan-announcer";
import { PlanLeaveGuard } from "@/features/planning/plan-leave/plan-leave-guard";
import { PlanNotices } from "@/features/planning/budget-plan/plan-notices";
import { PlanReferencePanel } from "@/features/planning/budget-plan/plan-reference-panel";
import { PlanSaveBar } from "@/features/planning/budget-plan/plan-save-bar";
import { PlanSaveFailure } from "@/features/planning/budget-plan/plan-save-failure";
import { PlanStickyStrip } from "@/features/planning/budget-plan/plan-sticky-strip";
import { PlanWorkArea } from "@/features/planning/budget-plan/plan-work-area";
import { showUndoToast } from "@/features/planning/budget-plan/plan-undo-toast";
import { usePlanDraft } from "@/features/planning/budget-plan/use-plan-draft";
import { usePlanFigures } from "@/features/planning/budget-plan/use-plan-figures";
import { usePlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { usePlanGroupsOpen } from "@/features/planning/budget-plan/use-plan-groups-open";
import { usePlanReview } from "@/features/planning/budget-plan/use-plan-review";
import { usePlanSave } from "@/features/planning/budget-plan/use-plan-save";
import { useVisible } from "@/ui/runtime/use-visible";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { usePrivacy } from "@/privacy/privacy-provider";

type BudgetPlan = components["schemas"]["BudgetPlan"];

interface PlanEditorProps {
  plan: BudgetPlan;
  entries: readonly CategoryEntry[];
  scale: number;
  month: string;
  noHistory: boolean;
  // The reader kept editing over a navigation: the control that started it returns.
  onStay: () => void;
}

// The Plan view of a month (budget plan spec 5): the reference panel and its bar, the table
// of amounts the reader edits, the suggestion under review and the save bar. Every change is
// a draft until Save plan.
export function PlanEditor({
  plan,
  entries,
  scale,
  month,
  noHistory,
  onStay,
}: PlanEditorProps) {
  const t = useT();
  const today = useToday();
  const privacy = usePrivacy();
  const format = usePlanFormat(plan.currency, scale);
  const draft = usePlanDraft(plan);
  const [panelRef, panelVisible] = useVisible();
  const { collapsed, toggle, select } = usePlanGroupsOpen();

  const [highlighted, setHighlighted] = useState<string | null>(null);

  const past = month < today.slice(0, 7);
  const editable = !past && !format.hidden;
  const figures = usePlanFigures(plan, draft, entries, month, format);
  const { reference, unassigned, over, lastMonth } = figures;
  const review = usePlanReview(draft, figures.room, format, lastMonth);
  const save = usePlanSave(draft, month, format);

  const undoToast = (title: string) => {
    showUndoToast(title, t("plan.undo"), () => {
      draft.undo();
    });
  };

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const shortcut = planShortcut(event, editable, draft.canUndo);
    if (shortcut !== null) event.preventDefault();
    if (shortcut === "save") save.run();
    if (shortcut === "undo") draft.undo();
  };

  const bar = (
    <PlanAllocationBar
      segments={figures.segments}
      reference={reference ?? 0}
      format={format}
      highlighted={highlighted}
      onHighlight={setHighlighted}
      onSelect={select}
    />
  );

  return (
    // The keyboard shortcuts of the view (spec 5.2) listen where its controls are.
    <div className={styles.editor} onKeyDown={handleKeys}>
      <Stack gap={5}>
        <PlanNotices
          hidden={format.hidden}
          past={past}
          onShowAmounts={privacy.toggle}
        />

        <div ref={panelRef}>
          <PlanReferencePanel
            plan={plan}
            source={draft.source}
            fixed={draft.fixed}
            reference={reference}
            unassigned={unassigned}
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

        <PlanBuckets
          totals={figures.buckets}
          format={format}
          stored={plan.buckets}
          entries={entries}
        />

        <PlanAnnouncer over={over} figure={figures.figure} />
        {save.failure !== null && (
          <PlanSaveFailure message={save.failure.message} />
        )}

        <PlanWorkArea
          plan={plan}
          draft={draft}
          figures={figures}
          review={review}
          format={format}
          month={month}
          editable={editable}
          noHistory={noHistory}
          collapsed={collapsed}
          highlighted={highlighted}
          invalid={save.failure?.invalid ?? new Set()}
          onToggle={toggle}
          onHighlight={setHighlighted}
          onUndoable={undoToast}
        />
      </Stack>

      {editable && (
        <PlanSaveBar
          pending={draft.pending}
          delta={format.signed(draft.delta)}
          applies={figures.applies}
          saving={save.saving}
          onDiscard={() => {
            draft.discard();
            save.clearFailure();
            undoToast(t("plan.discarded"));
          }}
          onSave={save.run}
        />
      )}
      <PlanLeaveGuard
        pending={draft.pending}
        month={format.month(month)}
        onDiscard={() => {
          draft.discard();
        }}
        onStay={onStay}
      />
    </div>
  );
}
