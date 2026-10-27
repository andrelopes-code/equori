import { useReducer } from "react";

import type { components } from "@/api/schema.gen";
import { largestRemainder, planTotals } from "@/features/planning/plan-math";
import type { PlanDraftRow } from "@/features/planning/plan-math";

type BudgetPlan = components["schemas"]["BudgetPlan"];
type BudgetPlanSource = components["schemas"]["BudgetPlanSource"];
type BudgetPlanInput = components["schemas"]["BudgetPlanInput"];

interface Snapshot {
  drafts: ReadonlyMap<string, number>;
  source: BudgetPlanSource | undefined;
  fixed: number | undefined;
}

interface State extends Snapshot {
  undo: Snapshot[];
}

type Action =
  | { type: "set"; id: string; amount: number }
  | { type: "revert"; id: string }
  | { type: "source"; source: BudgetPlanSource; fixed: number | undefined }
  | { type: "bulk"; next: Snapshot }
  | { type: "undo" }
  | { type: "reset" };

const empty: State = {
  drafts: new Map(),
  source: undefined,
  fixed: undefined,
  undo: [],
};

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "set":
      return {
        ...state,
        drafts: new Map(state.drafts).set(action.id, action.amount),
      };
    case "revert": {
      const drafts = new Map(state.drafts);
      drafts.delete(action.id);
      return { ...state, drafts };
    }
    case "source":
      return { ...state, source: action.source, fixed: action.fixed };
    case "bulk": {
      const { undo, ...now } = state;
      return { ...action.next, undo: [...undo, now] };
    }
    case "undo": {
      const last = state.undo.at(-1);
      return last === undefined
        ? state
        : { ...last, undo: state.undo.slice(0, -1) };
    }
    case "reset":
      return empty;
  }
}

// The changes the Plan view holds over a fetched plan until it saves them (budget plan A132).
// A row's draft is its planned amount until the reader changes it; suggestion, distribution
// and discard are one undo step each.
export function usePlanDraft(plan: BudgetPlan) {
  const [state, dispatch] = useReducer(reduce, empty);
  const source = state.source ?? plan.source;
  const fixed = state.source === undefined ? plan.fixed?.amount : state.fixed;
  const rows: PlanDraftRow[] = plan.rows.map((r) => ({
    ...r,
    draft: state.drafts.get(r.category_id) ?? r.planned.amount,
  }));
  const reference =
    source === "expected_income"
      ? plan.expected_income?.amount
      : source === "average_income"
        ? plan.average_income?.amount
        : fixed;
  const { planned, unassigned } = planTotals(rows, {
    reference,
    installments: plan.installments.amount,
    savings: plan.savings.amount,
  });
  const changed = rows.filter((r) => r.draft !== r.planned.amount);
  const referenceChanged =
    source !== plan.source ||
    (source === "fixed" && fixed !== plan.fixed?.amount);
  const now: Snapshot = {
    drafts: state.drafts,
    source: state.source,
    fixed: state.fixed,
  };
  const withDrafts = (changes: ReadonlyMap<string, number>) => {
    const drafts = new Map(state.drafts);
    for (const [id, amount] of changes) drafts.set(id, amount);
    return { ...now, drafts };
  };
  return {
    rows,
    source,
    fixed,
    reference,
    planned,
    unassigned,
    pending: changed.length + (referenceChanged ? 1 : 0),
    delta: changed.reduce(
      (sum, r) => sum + (r.counted ? r.draft - r.planned.amount : 0),
      0,
    ),
    canUndo: state.undo.length > 0,
    set(categoryId: string, amount: number) {
      dispatch({ type: "set", id: categoryId, amount });
    },
    revert(categoryId: string) {
      dispatch({ type: "revert", id: categoryId });
    },
    setSource(next: BudgetPlanSource, amount?: number) {
      dispatch({ type: "source", source: next, fixed: amount });
    },
    apply(changes: ReadonlyMap<string, number>) {
      if (changes.size > 0)
        dispatch({ type: "bulk", next: withDrafts(changes) });
    },
    distribute(mode: "proportional" | { categoryId: string }) {
      if (unassigned === undefined || unassigned <= 0) return;
      if (mode !== "proportional") {
        const row = rows.find((r) => r.category_id === mode.categoryId);
        if (row !== undefined)
          dispatch({
            type: "bulk",
            next: withDrafts(
              new Map([[row.category_id, row.draft + unassigned]]),
            ),
          });
        return;
      }
      const counted = rows.filter((r) => r.counted);
      const parts = largestRemainder(
        unassigned,
        counted.map((r) => r.draft),
      );
      if (parts.every((p) => p === 0)) return;
      dispatch({
        type: "bulk",
        next: withDrafts(
          new Map(
            counted.map((r, i) => [r.category_id, r.draft + (parts[i] ?? 0)]),
          ),
        ),
      });
    },
    undo() {
      dispatch({ type: "undo" });
    },
    discard() {
      dispatch({
        type: "bulk",
        next: { drafts: new Map(), source: undefined, fixed: undefined },
      });
    },
    // After a save the fetched plan holds the drafts; nothing is left to undo.
    reset() {
      dispatch({ type: "reset" });
    },
    payload(): BudgetPlanInput {
      return {
        source,
        ...(source === "fixed" && fixed !== undefined
          ? { fixed: { amount: fixed, currency: plan.currency } }
          : {}),
        amounts: changed.map((r) => ({
          category_id: r.category_id,
          amount: { amount: r.draft, currency: plan.currency },
        })),
      };
    },
  };
}
