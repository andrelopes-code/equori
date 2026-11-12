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

const barOf = (track: HTMLElement) =>
  (track.firstElementChild as HTMLElement).style.inlineSize;

describe("Contribution plan track scale", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("draws a member at 100% without squeezing the class bars", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    await renderApp("/portfolio/contribution-plan", {
      fetch: portfolioApi({
        "GET /api/v1/contribution-plan": () => json(200, plan),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogPtBR["contributionPlan.title"],
    });
    const classBar = barOf(
      await within(table).findByRole("img", { name: /^Ações:/ }),
    );

    await userEvent.click(within(table).getAllByRole("button").at(0) ?? table);
    const memberBar = barOf(
      await within(table).findByRole("img", { name: /^PETR4:/ }),
    );

    expect(classBar).toBe(`${String((5000 / 5500) * 100)}%`);
    expect(memberBar).toBe(`${String((10000 / 10500) * 100)}%`);
  });
});
