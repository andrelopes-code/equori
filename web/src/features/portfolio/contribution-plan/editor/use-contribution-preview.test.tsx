import { useState } from "react";

import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { startEditing } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { useContributionPreview } from "@/features/portfolio/contribution-plan/editor/use-contribution-preview";
import type { PlanDraft } from "@/features/portfolio/contribution-plan/model/plan-draft";
import { json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

type Plan = components["schemas"]["ContributionPlan"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

const rule = { instrument_type: "fixed_income", return_kind: "rate" } as const;

const plan = (rules: (typeof rule)[]): Plan => ({
  status: "complete",
  total: brl(1000000),
  drift_bp: 0,
  classes: [
    {
      name: "Pós",
      target_bp: 10000,
      value: brl(1000000),
      share_bp: 10000,
      questions: [],
      question_facts: [],
      question_limits: [],
      question_ideals: false,
      rules,
      matched: [],
      members: [],
    },
  ],
  outside: [],
  missing: [],
});

// A saved plan with one member, whose one criterion the filings answer so.
const answered = (answer: "none" | "yes"): Plan => ({
  ...plan([]),
  classes: plan([]).classes.map((cls) => ({
    ...cls,
    questions: ["Retorno sobre os ativos positivo"],
    question_facts: ["piotroski_p1"],
    question_limits: [""],
    members: [
      {
        instrument: "BPAC11",
        value: brl(1000000),
        answers: [false],
        fact_answers: [answer],
        fact_details: [{}],
      },
    ],
  })),
});

function setup() {
  const bodies: { amount?: unknown; classes: unknown[] }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    bodies.push((await req.json()) as (typeof bodies)[number]);

    const answer = plan([rule]);
    const [cls] = answer.classes;

    return json(200, {
      ...answer,
      classes: [{ ...cls, matched: [{ instrument: "CDB1", value: brl(1) }] }],
    });
  };
  let view: Plan | undefined;
  let setPlan: (plan: Plan) => void = () => undefined;

  function Probe({ plan: first, draft }: { plan: Plan; draft?: PlanDraft }) {
    const [saved, setSaved] = useState(first);
    setPlan = setSaved;
    view = useContributionPreview(saved, draft).view;

    return null;
  }

  const mount = (saved: Plan, draft?: PlanDraft) =>
    renderWithProviders(
      <Probe plan={saved} {...(draft === undefined ? {} : { draft })} />,
      { fetch: fetchImpl },
    );

  const refetch = (next: Plan) => {
    act(() => {
      setPlan(next);
    });
  };

  return { bodies, mount, refetch, view: () => view };
}

describe("useContributionPreview", () => {
  it("sends a preview without amount when a group has rules", async () => {
    const { bodies, mount, view } = setup();
    mount(plan([rule]));

    await waitFor(() => {
      expect(bodies.length).toBeGreaterThan(0);
    });

    // StrictMode runs the effect twice; every body is the same, with no amount.
    for (const body of bodies)
      expect(body).toEqual({
        classes: [
          { name: "Pós", target_bp: 10000, members: [], rules: [rule] },
        ],
      });
    await waitFor(() => {
      expect(view()?.classes[0]?.matched).toEqual([
        { instrument: "CDB1", value: brl(1) },
      ]);
    });
  });

  it("sends no preview without amount when no group has rules", async () => {
    const { bodies, mount, view } = setup();
    mount(plan([]));

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(bodies).toHaveLength(0);
    expect(view()?.classes[0]?.rules).toEqual([]);
  });

  it("sends the preview again when the answers of the saved plan change", async () => {
    const { bodies, mount, refetch } = setup();
    mount({ ...answered("none"), amount: brl(5000) });

    // StrictMode sends the first preview twice.
    await waitFor(() => {
      expect(bodies).toHaveLength(2);
    });

    const sent = bodies.length;
    refetch({ ...answered("none"), amount: brl(5000) });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(bodies).toHaveLength(sent);

    refetch({ ...answered("yes"), amount: brl(5000) });

    await waitFor(() => {
      expect(bodies).toHaveLength(sent + 1);
    });
    expect(bodies.at(-1)).toEqual(bodies[0]);
  });

  it("sends a draft with criteria without amount, less the incomplete ones", async () => {
    const { bodies, mount } = setup();
    mount(
      plan([]),
      startEditing({
        classes: [
          {
            name: "Ações",
            targetBp: 10000,
            byQuestions: true,
            questions: ["Entendo?", "", "P/L de até"],
            questionFacts: ["", "", "price_earnings_max"],
            questionLimits: ["", "", ""],
            members: [{ instrument: "WEGE3", answers: [true, false, false] }],
            rules: [],
          },
        ],
      }),
    );

    await waitFor(() => {
      expect(bodies.length).toBeGreaterThan(0);
    });

    for (const body of bodies)
      expect(body).toEqual({
        classes: [
          {
            name: "Ações",
            target_bp: 10000,
            questions: ["Entendo?"],
            members: [{ instrument: "WEGE3", answers: [true] }],
          },
        ],
      });
  });
});
