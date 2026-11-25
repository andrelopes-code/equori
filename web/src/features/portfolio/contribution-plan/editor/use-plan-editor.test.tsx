import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { usePlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

type Plan = components["schemas"]["ContributionPlan"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

const plan: Plan = {
  status: "complete",
  total: brl(1000),
  drift_bp: 0,
  classes: [
    {
      name: "Pós",
      target_bp: 10000,
      value: brl(1000),
      share_bp: 10000,
      questions: [],
      question_facts: [],
      question_limits: [],
      question_ideals: false,
      question_effects: [],
      question_reviews: [],
      held: false,
      rules: [],
      matched: [],
      members: [{ instrument: "CDB1", value: brl(1000), share_bp: 10000 }],
    },
  ],
  outside: [],
  missing: [],
  revision: 1,
  holds_ignored: false,
};

function setup() {
  const result: { current: ReturnType<typeof usePlanEditor> | undefined } = {
    current: undefined,
  };

  function Probe() {
    result.current = usePlanEditor(plan);

    return null;
  }

  renderWithProviders(<Probe />, { fetch: fakeApi({}) });

  return {
    editor: () => {
      if (result.current === undefined) throw new Error("not rendered");

      return result.current;
    },
  };
}

describe("usePlanEditor rules", () => {
  it("turns a group to rules, adds, replaces and removes a rule", () => {
    const { editor } = setup();
    const rate = { instrument_type: "fixed_income" };
    const stock = { instrument_type: "stock" };
    const first = () => editor().draft?.classes[0];

    act(() => {
      editor().setByRule(0, true);
    });
    expect(first()?.byRule).toBe(true);
    expect(first()?.members).toEqual([]);

    act(() => {
      editor().addRule(0, rate);
    });
    expect(first()?.rules).toEqual([rate]);

    act(() => {
      editor().replaceRule(0, 0, stock);
    });
    expect(first()?.rules).toEqual([stock]);

    act(() => {
      editor().removeRule(0, 0);
    });
    expect(first()?.rules).toEqual([]);
  });
});
