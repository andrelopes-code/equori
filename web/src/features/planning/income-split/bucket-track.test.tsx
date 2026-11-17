import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { money } from "@/testing/account-api";
import { budgetApi } from "@/testing/budget-api";
import { json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const october = "/planning?tab=budgets&view=track&month=2026-10";
const today = "2026-11-10";

const buckets = [
  {
    id: "b0000000-0000-4000-8000-000000000001",
    name: "Needs",
    share_bp: 6000,
    takes_savings: false,
    takes_goals: false,
    at_least: false,
    category_ids: [],
  },
  {
    id: "b0000000-0000-4000-8000-000000000002",
    name: "Freedom",
    share_bp: 4000,
    takes_savings: true,
    takes_goals: false,
    at_least: false,
    category_ids: [],
  },
];

function month(m: string, received: number, needs: number, free: number) {
  return {
    month: m,
    from: "2026-05",
    received: money(received),
    outside: money(m === "2026-10" ? 1500 : 0),
    buckets: [
      { id: buckets[0]?.id ?? "", real: money(needs) },
      { id: buckets[1]?.id ?? "", real: money(free) },
    ],
  };
}

const history = {
  currency: "BRL",
  methods: [{ from: "2026-05", buckets }],
  months: [
    month("2026-05", 500000, 250000, 250000),
    month("2026-06", 500000, 350000, 150000),
    month("2026-07", 0, 10000, -10000),
    month("2026-08", 500000, 300000, 200000),
    month("2026-09", 500000, 280000, 220000),
    month("2026-10", 500000, 320000, 180000),
  ],
};

const section = () =>
  screen.findByRole("heading", { name: catalogEn["buckets.title"] });

describe("Income split in Track", () => {
  it("states the month before the figures and each bucket in words", async () => {
    await renderApp(october, {
      fetch: budgetApi({
        "GET /api/v1/budget-buckets/history": () => json(200, history),
      }),
      today,
    });
    await section();

    // 60% of R$5,000.00 is R$3,000.00: Needs spent R$3,200.00; Freedom kept R$1,800.00 of R$2,000.00.
    expect(
      screen.getByText(/In October, 2 of 2 buckets missed their target\./),
    ).toBeVisible();
    expect(screen.getByText("R$200.00 over")).toBeVisible();
    expect(screen.getByText("R$200.00 short")).toBeVisible();
    expect(screen.getByText("R$3,200.00 · 64.0% of income")).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Needs: R$3,200.00 against a target of R$3,000.00",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("R$15.00 spent outside the split in October."),
    ).toBeVisible();

    const strips = screen.getAllByRole("list");
    const needs = strips.find((s) =>
      within(s).queryByRole("listitem", { name: "Jul: no income" }),
    );
    expect(
      within(needs ?? document.body)
        .getAllByRole("listitem")
        .map((c) => c.getAttribute("aria-label")),
    ).toEqual([
      "May: kept to the target",
      "Jun: missed the target",
      "Jul: no income",
      "Aug: kept to the target",
      "Sep: kept to the target",
      "Oct: missed the target",
    ]);
  });

  it("states the version of the month on screen", async () => {
    await renderApp(october, {
      fetch: budgetApi({
        "GET /api/v1/budget-buckets/history": () => json(200, history),
        "GET /api/v1/budget-buckets/versions": () =>
          json(200, {
            versions: [
              { from: "2026-03", buckets },
              { from: "2026-05", buckets },
            ],
          }),
      }),
      today,
    });
    await section();

    expect(
      await screen.findByText("Split in force since May 2026."),
    ).toBeVisible();
  });

  it("draws nothing while the book has no split", async () => {
    await renderApp(october, {
      fetch: budgetApi({
        "GET /api/v1/budget-buckets/history": () =>
          json(200, { ...history, methods: [] }),
      }),
      today,
    });
    await screen.findAllByText(/October/);

    expect(
      screen.queryByRole("heading", { name: catalogEn["buckets.title"] }),
    ).toBeNull();
  });
});
