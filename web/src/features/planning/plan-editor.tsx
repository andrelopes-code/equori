import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import { toast } from "@slotted/react/toast";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { useSaveBudgetPlan } from "@/features/planning/api";
import styles from "@/features/planning/budget-plan.module.css";
import { PlanAllocationBar } from "@/features/planning/plan-allocation-bar";
import type {
  PlanSegment,
  SegmentTone,
} from "@/features/planning/plan-allocation-bar";
import { PlanDiscardDialog } from "@/features/planning/plan-discard-dialog";
import { PlanDistributeDialog } from "@/features/planning/plan-distribute-dialog";
import { planGroups } from "@/features/planning/plan-groups";
import { fitToRoom, suggestion } from "@/features/planning/plan-math";
import { PlanReferencePanel } from "@/features/planning/plan-reference-panel";
import type { RowReview } from "@/features/planning/plan-row";
import { PlanSaveBar } from "@/features/planning/plan-save-bar";
import { PlanStickyStrip } from "@/features/planning/plan-sticky-strip";
import { PlanSuggestionBanner } from "@/features/planning/plan-suggestion-banner";
import { PlanTable } from "@/features/planning/plan-table";
import { PlanToolbar } from "@/features/planning/plan-toolbar";
import type { SuggestBasis } from "@/features/planning/plan-toolbar";
import { usePlanDraft } from "@/features/planning/use-plan-draft";
import { usePlanFormat } from "@/features/planning/use-plan-format";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { usePrivacy } from "@/privacy/privacy-provider";
import { useDebounced } from "@/ui/use-debounced";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

type BudgetPlan = components["schemas"]["BudgetPlan"];

// Per-browser convenience: the groups a reader folded stay folded (spec 5.1).
const collapsedKey = "equori.plan.collapsed";
const groupTones: readonly SegmentTone[] = [
  "data-1",
  "data-2",
  "data-3",
  "data-4",
  "data-5",
  "data-6",
  "data-7",
  "data-8",
];

function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(collapsedKey);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function writeCollapsed(ids: ReadonlySet<string>) {
  try {
    localStorage.setItem(collapsedKey, JSON.stringify([...ids]));
  } catch {
    // A browser without storage keeps the groups open on the next visit.
  }
}

function previous(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const year = (y ?? 0) - (m === 1 ? 1 : 0);
  const mo = m === 1 ? 12 : (m ?? 1) - 1;
  return `${String(year)}-${String(mo).padStart(2, "0")}`;
}

interface Review {
  basis: SuggestBasis;
  proposals: ReadonlyMap<string, number>;
  unchecked: ReadonlySet<string>;
  fit: boolean;
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
}: {
  plan: BudgetPlan;
  entries: readonly CategoryEntry[];
  scale: number;
  month: string;
  noHistory: boolean;
  // The reader kept editing over a navigation: the control that started it returns.
  onStay: () => void;
}) {
  const t = useT();
  const today = useToday();
  const compact = useMediaQuery(compactQuery);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const privacy = usePrivacy();
  const format = usePlanFormat(plan.currency, scale);
  const draft = usePlanDraft(plan);
  const save = useSaveBudgetPlan(month);
  const past = month < today.slice(0, 7);
  const editable = !past && !format.hidden;
  const [unit, setUnit] = useState<"money" | "share">("money");
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [picking, setPicking] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    invalid: ReadonlySet<string>;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelVisible, setPanelVisible] = useState(true);
  // A navigation over unsaved changes waits on the reader's answer.
  const [asking, setAsking] = useState<((block: boolean) => void) | null>(null);
  useBlocker({
    shouldBlockFn: () =>
      draft.pending === 0
        ? false
        : new Promise<boolean>((resolve) => {
            setAsking(() => resolve);
          }),
    enableBeforeUnload: () => draft.pending > 0,
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (panel === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setPanelVisible(entry?.isIntersecting ?? true);
    });
    observer.observe(panel);
    return () => {
      observer.disconnect();
    };
  }, []);

  const reference = draft.reference;
  const room =
    reference === undefined
      ? undefined
      : reference - plan.installments.amount - plan.savings.amount;
  const committed =
    plan.installments.amount + plan.savings.amount + draft.planned;
  const unassigned = draft.unassigned;
  const over = unassigned !== undefined && unassigned < 0;
  const groups = planGroups(entries, draft.rows, t("plan.withoutBudget"));
  const previousMonth = format.monthName(previous(month));

  // The segments of the bar: commitments, the groups by size and the rest.
  const segments: PlanSegment[] = [];
  if (plan.installments.amount > 0)
    segments.push({
      key: "installments",
      name: t("plan.installments"),
      amount: plan.installments.amount,
      tone: "commitment",
    });
  if (plan.savings.amount > 0)
    segments.push({
      key: "savings",
      name: t("plan.savings"),
      amount: plan.savings.amount,
      tone: "commitment",
    });
  [...groups]
    .filter((g) => g.draft > 0)
    .sort((a, b) => b.draft - a.draft)
    .forEach((g, i) => {
      segments.push({
        key: g.id,
        name: g.name,
        amount: g.draft,
        tone: groupTones[i % groupTones.length] ?? "data-1",
        group: g.id,
      });
    });
  if (unassigned !== undefined && unassigned > 0)
    segments.push({
      key: "rest",
      name: t("plan.unassigned"),
      amount: unassigned,
      tone: "rest",
    });
  if (over)
    segments.push({
      key: "over",
      name: t("plan.overSegment"),
      amount: -unassigned,
      tone: "over",
    });

  const select = (group: string) => {
    if (collapsed.has(group)) toggle(group);
    document.getElementById(`plan-group-${group}`)?.scrollIntoView({
      block: "center",
      behavior: reduced ? "auto" : "smooth",
    });
  };
  const toggle = (group: string) => {
    const next = new Set(collapsed);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setCollapsed(next);
    writeCollapsed(next);
  };
  const bar = (
    <PlanAllocationBar
      segments={segments}
      reference={reference ?? 0}
      format={format}
      highlighted={highlighted}
      onHighlight={setHighlighted}
      onSelect={select}
    />
  );

  const undoToast = (title: string) => {
    const id = `plan-undo-${String(Date.now())}`;
    toast.show({
      id,
      tone: "secondary",
      title,
      duration: 8000,
      actions: (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            draft.undo();
            toast.dismiss(id);
          }}
        >
          {t("plan.undo")}
        </Button>
      ),
    });
  };

  // The suggestion under review: proposals fitted to the room when asked, checked by default.
  let reviewRows: Map<string, RowReview> | undefined;
  let reviewSummary = "";
  let canFit = false;
  let accepted = new Map<string, number>();
  if (review !== null) {
    const counted = new Set(
      draft.rows.filter((r) => r.counted).map((r) => r.category_id),
    );
    const steady = draft.rows
      .filter((r) => r.counted && !review.proposals.has(r.category_id))
      .reduce((sum, r) => sum + r.draft, 0);
    const proposedCounted = new Map(
      [...review.proposals].filter(([id]) => counted.has(id)),
    );
    const proposedSum = [...proposedCounted.values()].reduce(
      (a, v) => a + v,
      0,
    );
    canFit = room !== undefined && steady + proposedSum > room;
    const fitted =
      review.fit && canFit && room !== undefined
        ? new Map([
            ...review.proposals,
            ...fitToRoom(proposedCounted, room - steady),
          ])
        : review.proposals;
    reviewRows = new Map();
    for (const [id, value] of fitted) {
      const checked = !review.unchecked.has(id);
      if (checked) accepted.set(id, value);
      reviewRows.set(id, {
        suggested: value,
        checked,
        onCheck: (on) => {
          const unchecked = new Set(review.unchecked);
          if (on) unchecked.delete(id);
          else unchecked.add(id);
          setReview({ ...review, unchecked });
        },
      });
    }
    const delta = draft.rows.reduce(
      (sum, r) =>
        sum +
        (r.counted && accepted.has(r.category_id)
          ? (accepted.get(r.category_id) ?? 0) - r.draft
          : 0),
      0,
    );
    const basis =
      review.basis === "average"
        ? t("plan.suggest.average")
        : t("plan.suggest.lastMonth", { month: previousMonth });
    const rest = unassigned === undefined ? undefined : unassigned - delta;
    reviewSummary =
      fitted.size === 0
        ? t("plan.reviewNone", { basis })
        : t(fitted.size === 1 ? "plan.reviewOne" : "plan.review", {
            basis,
            count: String(fitted.size),
            delta: format.signed(delta),
            rest: rest === undefined ? t("plan.dash") : format.money(rest),
          });
  } else {
    accepted = new Map();
  }

  const doSave = () => {
    if (draft.pending === 0 || save.isPending) return;
    const body = draft.payload();
    save.mutate(body, {
      onSuccess: () => {
        draft.reset();
        setFailure(null);
        toast.show({
          tone: "success",
          title: t("plan.saved", { month: format.month(month) }),
        });
      },
      onError: (error) => {
        const invalid = new Set<string>();
        if (error instanceof ProblemError) {
          for (const field of Object.keys(fieldErrors(error.problem))) {
            const index = /^amounts\[(\d+)\]/.exec(field)?.[1];
            const id =
              index === undefined
                ? undefined
                : body.amounts[Number(index)]?.category_id;
            if (id !== undefined) invalid.add(id);
          }
        }
        setFailure({ message: errorText(error, t), invalid });
      },
    });
  };

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "s" && editable) {
      event.preventDefault();
      doSave();
    } else if (
      mod &&
      event.key.toLowerCase() === "z" &&
      !(event.target instanceof HTMLInputElement) &&
      draft.canUndo
    ) {
      event.preventDefault();
      draft.undo();
    }
  };

  const next = draft.rows
    .filter((r) => r.draft !== r.planned.amount && r.next_change !== undefined)
    .map((r) => r.next_change ?? "")
    .sort()[0];
  const applies =
    next === undefined
      ? t("plan.applies", { month: format.month(month) })
      : t("plan.appliesUntil", {
          month: format.month(month),
          until: format.month(previous(next)),
        });
  const figureText =
    unassigned === undefined
      ? t("plan.dash")
      : format.money(Math.abs(unassigned));
  const announced = useDebounced(
    `${over ? t("plan.over") : t("plan.unassigned")} ${figureText}`,
    500,
  );

  return (
    // The keyboard shortcuts of the view (spec 5.2) listen where its controls are.
    <div className={styles.editor} onKeyDown={keys}>
      <Stack gap={5}>
        {format.hidden && (
          <Alert tone="info">
            <AlertContent>
              <AlertDescription>{t("plan.privacy")}</AlertDescription>
            </AlertContent>
            <AlertActions>
              <Button
                size="sm"
                variant="outline"
                tone="secondary"
                onClick={privacy.toggle}
              >
                {t("plan.showAmounts")}
              </Button>
            </AlertActions>
          </Alert>
        )}
        {past && (
          <Alert tone="secondary">
            <AlertContent>
              <AlertDescription>{t("plan.pastMonth")}</AlertDescription>
            </AlertContent>
          </Alert>
        )}
        <div ref={panelRef}>
          <PlanReferencePanel
            plan={plan}
            source={draft.source}
            fixed={draft.fixed}
            reference={reference}
            unassigned={unassigned}
            committed={committed}
            format={format}
            editable={editable}
            compact={compact}
            bar={bar}
            onSource={(source, fixed) => {
              draft.setSource(source, fixed);
            }}
          />
        </div>
        <PlanStickyStrip
          shown={!panelVisible}
          label={over ? t("plan.over") : t("plan.unassigned")}
          figure={figureText}
          reference={
            reference === undefined ? undefined : format.money(reference)
          }
          over={over}
          compact={compact}
          bar={bar}
        />
        <VisuallyHidden>
          <span aria-live="polite">{announced}</span>
        </VisuallyHidden>
        {failure !== null && (
          <Alert tone="danger">
            <AlertContent>
              <AlertTitle>{t("plan.saveFailed")}</AlertTitle>
              <AlertDescription>{failure.message}</AlertDescription>
            </AlertContent>
          </Alert>
        )}
        <Stack gap={3}>
          {editable ? (
            <PlanToolbar
              heading={t("plan.heading", { month: format.month(month) })}
              previousMonth={previousMonth}
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
                const proposals = suggestion(draft.rows, basis);
                setReview({
                  basis,
                  proposals,
                  unchecked: new Set(),
                  fit: true,
                });
              }}
            />
          ) : (
            <Text size="md" weight="semibold">
              {t("plan.heading", { month: format.month(month) })}
            </Text>
          )}
          {noHistory && (
            <Text size="sm" tone="muted">
              {t("plan.noHistory")}
            </Text>
          )}
          {review !== null && (
            <PlanSuggestionBanner
              summary={reviewSummary}
              checked={accepted.size}
              fit={review.fit}
              canFit={canFit}
              onFit={(fit) => {
                setReview({ ...review, fit });
              }}
              onApply={() => {
                draft.apply(accepted);
                setReview(null);
                undoToast(
                  accepted.size === 1
                    ? t("plan.appliedOne")
                    : t("plan.applied", { count: String(accepted.size) }),
                );
              }}
              onDiscard={() => {
                setReview(null);
              }}
            />
          )}
          <PlanTable
            caption={t("plan.heading", { month: format.month(month) })}
            groups={groups}
            collapsed={collapsed}
            previousMonth={previousMonth}
            format={format}
            unit={unit}
            reference={reference}
            rest={unassigned ?? 0}
            editable={editable}
            invalid={failure?.invalid ?? new Set()}
            highlighted={highlighted}
            compact={compact}
            review={reviewRows}
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
          applies={applies}
          saving={save.isPending}
          onDiscard={() => {
            draft.discard();
            setFailure(null);
            undoToast(t("plan.discarded"));
          }}
          onSave={doSave}
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
      {asking !== null && (
        <PlanDiscardDialog
          pending={draft.pending}
          month={format.month(month)}
          onKeep={() => {
            asking(true);
            setAsking(null);
            onStay();
          }}
          onDiscard={() => {
            draft.discard();
            asking(false);
            setAsking(null);
          }}
        />
      )}
    </div>
  );
}
