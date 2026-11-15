import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useState } from "react";
import type { KeyboardEvent } from "react";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import styles from "@/features/planning/budget-plan/budget-plan.module.css";
import { BucketDialog } from "@/features/planning/income-split/bucket-dialog";
import { PlanAllocationBar } from "@/features/planning/budget-plan/plan-allocation-bar";
import { PlanDistributeDialog } from "@/features/planning/budget-plan/plan-distribute-dialog";
import { planShortcut } from "@/features/planning/budget-plan/plan-keys";
import { suggestion } from "@/features/planning/budget-plan/plan-math";
import { PlanBuckets } from "@/features/planning/income-split/plan-buckets";
import { PlanLeaveGuard } from "@/features/planning/budget-plan/plan-leave-guard";
import { PlanNotices } from "@/features/planning/budget-plan/plan-notices";
import { PlanReferencePanel } from "@/features/planning/budget-plan/plan-reference-panel";
import { PlanSaveBar } from "@/features/planning/budget-plan/plan-save-bar";
import { PlanSaveFailure } from "@/features/planning/budget-plan/plan-save-failure";
import { PlanStickyStrip } from "@/features/planning/budget-plan/plan-sticky-strip";
import { PlanSuggestionBanner } from "@/features/planning/budget-plan/plan-suggestion-banner";
import { PlanTable } from "@/features/planning/budget-plan/plan-table";
import { PlanToolbar } from "@/features/planning/budget-plan/plan-toolbar";
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
import { useDebounced } from "@/ui/runtime/use-debounced";

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

  const [unit, setUnit] = useState<"money" | "share">("money");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [splitting, setSplitting] = useState(false);

  const past = month < today.slice(0, 7);
  const editable = !past && !format.hidden;
  const figures = usePlanFigures(plan, draft, entries, month, format);
  const { reference, unassigned, over, groups, lastMonth } = figures;
  const review = usePlanReview(draft, figures.room, format, lastMonth);
  const save = usePlanSave(draft, month, format);
  const announced = useDebounced(
    `${over ? t("plan.over") : t("plan.unassigned")} ${figures.figure}`,
    500,
  );

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
          outsideSpent={plan.outside_spent?.amount ?? 0}
          month={format.monthName(month)}
          format={format}
          onEdit={() => {
            setSplitting(true);
          }}
        />

        <VisuallyHidden>
          <span aria-live="polite">{announced}</span>
        </VisuallyHidden>
        {save.failure !== null && (
          <PlanSaveFailure message={save.failure.message} />
        )}

        <Stack gap={3}>
          {editable && (
            <PlanToolbar
              heading={t("plan.heading", { month: format.month(month) })}
              previousMonth={lastMonth}
              unit={unit}
              shareable={reference !== undefined && reference > 0}
              canDistribute={unassigned !== undefined && unassigned > 0}
              suggestPrimary={
                noHistory || plan.rows.every((r) => r.budget_id === undefined)
              }
              onUnit={setUnit}
              onDistribute={() => {
                draft.distribute("proportional");
                undoToast(t("plan.distributed"));
              }}
              onPickOne={() => {
                setPicking(true);
              }}
              onSuggest={(basis) => {
                review.start(basis, suggestion(draft.rows, basis));
              }}
            />
          )}
          {!editable && (
            <Text size="md" weight="semibold">
              {t("plan.heading", { month: format.month(month) })}
            </Text>
          )}
          {noHistory && (
            <Text size="sm" tone="muted">
              {t("plan.noHistory")}
            </Text>
          )}
          {review.review !== null && (
            <PlanSuggestionBanner
              summary={review.summary}
              checked={review.accepted.size}
              fit={review.review.fit}
              canFit={review.canFit}
              onFit={review.setFit}
              onApply={() => {
                const count = review.apply();
                undoToast(
                  count === 1
                    ? t("plan.appliedOne")
                    : t("plan.applied", { count: String(count) }),
                );
              }}
              onDiscard={review.clear}
            />
          )}

          <PlanTable
            caption={t("plan.heading", { month: format.month(month) })}
            groups={groups}
            collapsed={collapsed}
            previousMonth={lastMonth}
            format={format}
            unit={unit}
            reference={reference}
            rest={unassigned ?? 0}
            editable={editable}
            invalid={save.failure?.invalid ?? new Set()}
            highlighted={highlighted}
            review={review.rows}
            onToggle={toggle}
            onHighlight={setHighlighted}
            onChange={(id, amount) => {
              if (amount === undefined) draft.revert(id);
              else draft.set(id, amount);
            }}
          />
        </Stack>
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
      {picking && (
        <PlanDistributeDialog
          rows={groups.flatMap((g) => g.lines)}
          rest={unassigned ?? 0}
          format={format}
          onCancel={() => {
            setPicking(false);
          }}
          onPick={(categoryId) => {
            setPicking(false);
            draft.distribute({ categoryId });
            undoToast(t("plan.distributed"));
          }}
        />
      )}
      {splitting && (
        <BucketDialog
          stored={plan.buckets}
          entries={entries}
          format={format}
          onClose={() => {
            setSplitting(false);
          }}
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
