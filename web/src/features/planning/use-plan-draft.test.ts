import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { planTotals } from "@/features/planning/plan-math";
import { usePlanDraft } from "@/features/planning/use-plan-draft";
import {
  budgetPlan,
  energy,
  market,
  pets,
  rent,
} from "@/testing/budget-plan-api";

const plan = budgetPlan("2026-11");

function draftOf(rows: { category_id: string; draft: number }[], id: string) {
  return rows.find((r) => r.category_id === id)?.draft;
}

describe("usePlanDraft", () => {
  it("sends only the changed rows", () => {
    const { result } = renderHook(() => usePlanDraft(plan));
    act(() => {
      result.current.set(energy.id, 20500);
    });
    expect(result.current.pending).toBe(1);
    expect(result.current.delta).toBe(2500);
    expect(result.current.unassigned).toBe(213500);
    expect(result.current.payload()).toEqual({
      source: "expected_income",
      amounts: [
        { category_id: energy.id, amount: { amount: 20500, currency: "BRL" } },
      ],
    });
  });

  it("reverts a row to its saved amount", () => {
    const { result } = renderHook(() => usePlanDraft(plan));
    act(() => {
      result.current.set(energy.id, 1);
    });
    act(() => {
      result.current.revert(energy.id);
    });
    expect(result.current.pending).toBe(0);
    expect(draftOf(result.current.rows, energy.id)).toBe(18000);
  });

  it("distributes the rest in proportion to the plan", () => {
    const { result } = renderHook(() => usePlanDraft(plan));
    act(() => {
      result.current.distribute("proportional");
    });
    const { unassigned } = planTotals(result.current.rows, {
      reference: 850000,
      installments: 64000,
      savings: 0,
    });
    expect(unassigned).toBe(0);
    expect(result.current.unassigned).toBe(0);
    // Rent holds 2,200.00 of 5,700.00 planned, so it takes that share of the 2,160.00.
    expect(draftOf(result.current.rows, rent.id)).toBe(220000 + 83368);
    expect(draftOf(result.current.rows, pets.id)).toBe(0);
  });

  it("sends the rest to one category", () => {
    const { result } = renderHook(() => usePlanDraft(plan));
    act(() => {
      result.current.distribute({ categoryId: pets.id });
    });
    expect(draftOf(result.current.rows, pets.id)).toBe(216000);
  });

  it("does nothing to distribute without a rest", () => {
    const { result } = renderHook(() => usePlanDraft(plan));
    act(() => {
      result.current.set(market.id, 400000);
    });
    act(() => {
      result.current.distribute("proportional");
    });
    expect(result.current.pending).toBe(1);
    expect(result.current.canUndo).toBe(false);
  });

  it("undoes a bulk change in one step", () => {
    const { result } = renderHook(() => usePlanDraft(plan));
    act(() => {
      result.current.set(energy.id, 19000);
    });
    act(() => {
      result.current.apply(
        new Map([
          [market.id, 124000],
          [pets.id, 21000],
        ]),
      );
    });
    expect(result.current.pending).toBe(3);
    act(() => {
      result.current.undo();
    });
    expect(result.current.pending).toBe(1);
    expect(draftOf(result.current.rows, energy.id)).toBe(19000);
    expect(result.current.canUndo).toBe(false);
  });

  it("counts a change of reference and sends the fixed amount", () => {
    const { result } = renderHook(() => usePlanDraft(plan));
    act(() => {
      result.current.setSource("fixed", 600000);
    });
    expect(result.current.pending).toBe(1);
    expect(result.current.reference).toBe(600000);
    expect(result.current.unassigned).toBe(600000 - 64000 - 570000);
    expect(result.current.payload()).toEqual({
      source: "fixed",
      fixed: { amount: 600000, currency: "BRL" },
      amounts: [],
    });
  });

  it("discards every change in one undo step", () => {
    const { result } = renderHook(() => usePlanDraft(plan));
    act(() => {
      result.current.set(energy.id, 19000);
      result.current.setSource("average_income");
    });
    act(() => {
      result.current.discard();
    });
    expect(result.current.pending).toBe(0);
    act(() => {
      result.current.undo();
    });
    expect(result.current.pending).toBe(2);
  });
});
