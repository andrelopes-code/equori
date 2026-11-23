import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { useContributionPreview } from "@/features/portfolio/contribution-plan/editor/use-contribution-preview";
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

  function Probe({ plan: saved }: { plan: Plan }) {
    view = useContributionPreview(saved).view;

    return null;
  }

  const mount = (saved: Plan) =>
    renderWithProviders(<Probe plan={saved} />, { fetch: fetchImpl });

  return { bodies, mount, view: () => view };
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
});
