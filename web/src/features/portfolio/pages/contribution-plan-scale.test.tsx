import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { json } from "@/testing/fake-api";
import { brl } from "@/testing/investment-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const cls = (
  name: string,
  target: number,
  share: number,
  members: unknown[],
) => ({
  name,
  target_bp: target,
  questions: [],
  question_ideals: false,
  rules: [],
  matched: [],
  value: brl(1000),
  share_bp: share,
  members,
});

const plan = {
  status: "complete",
  total: brl(1800000),
  drift_bp: 0,
  classes: [
    cls("Renda fixa", 5000, 5000, [
      { instrument: "PETR4", value: brl(1000), share_bp: 10000 },
    ]),
    cls("Ações", 5000, 5000, []),
  ],
  outside: [],
  missing: [],
};

const barOf = (bar: HTMLElement) =>
  bar.querySelector<HTMLElement>("[data-part='today']")?.style.inlineSize;

describe("Contribution plan bar scale", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("draws a member at 100% and a class at 50% on one scale from 0 to 100%", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    await renderApp("/portfolio/contribution-plan", {
      fetch: portfolioApi({
        "GET /api/v1/contribution-plan": () => json(200, plan),
      }),
    });
    const list = await screen.findByRole("list", {
      name: catalogPtBR["contributionPlan.ideal"],
    });
    const classBar = barOf(
      await within(list).findByRole("img", { name: /^Ações:/ }),
    );

    await userEvent.click(within(list).getAllByRole("button").at(0) ?? list);
    const memberBar = barOf(
      await within(list).findByRole("img", { name: /^PETR4:/ }),
    );

    expect(classBar).toBe("50%");
    expect(memberBar).toBe("100%");
  });
});
