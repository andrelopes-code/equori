import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountRoutes,
  brokerageID,
  checkingID,
  money,
  reserveID,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const emergency = {
  id: "d1000000-0000-4000-8000-000000000001",
  name: "Emergency fund",
  target: money(3000000),
  due_on: "2027-06-30",
  account_ids: [reserveID],
  current: money(1008341),
  remaining: money(1991659),
  progress_bp: 3361,
};
const trip = {
  id: "d1000000-0000-4000-8000-000000000002",
  name: "Trip",
  target: money(500000),
  due_on: "2026-12-31",
  account_ids: [checkingID],
  current: money(500000),
  remaining: money(0),
  progress_bp: 10000,
};
const laptop = {
  id: "d1000000-0000-4000-8000-000000000003",
  name: "Laptop",
  target: money(900000),
  due_on: "2026-09-30",
  account_ids: [checkingID],
  current: money(400000),
  remaining: money(500000),
  progress_bp: 4444,
};

function api(items: unknown[], schedules: unknown[] = []) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/goals": () => json(200, { items }),
      "GET /api/v1/schedules": () => json(200, { items: schedules }),
    }),
  );
}

const savings = {
  id: "e1000000-0000-4000-8000-000000000001",
  kind: "savings",
  calendar: "br_banking",
  account_id: checkingID,
  counterpart_id: reserveID,
  description: "Monthly savings",
  match_tolerance_bp: 0,
  grace_days: 0,
  terms: [
    {
      effective_from: "2026-01-01",
      amount: money(100000),
      recurrence: { frequency: "monthly", interval: 1, start: "2026-01-05" },
    },
  ],
  pauses: [],
};

const portfolio = {
  ...emergency,
  id: "d1000000-0000-4000-8000-000000000004",
  name: "Portfolio",
  account_ids: [brokerageID],
  parts: [
    {
      account_id: brokerageID,
      instrument: "BRL",
      quantity: money(504171),
      value: money(504171),
    },
    {
      account_id: brokerageID,
      instrument: "PETR4",
      quantity: { amount: 100, currency: "PETR4" },
      value: money(504170),
    },
  ],
  prices: [
    {
      instrument: "PETR4",
      quote_instrument: "BRL",
      date: "2026-10-16",
      value: "38.2",
      source: "b3_cotahist",
    },
  ],
};

describe("GoalsPage", () => {
  it("shows the progress, the amounts and the due date of a goal", async () => {
    await renderApp("/goals", { fetch: api([emergency]) });
    const card = await screen.findByRole("article", { name: "Emergency fund" });
    expect(
      within(card).getByRole("meter", { name: "Emergency fund" }),
    ).toHaveAttribute("aria-valuenow", "33.61");
    expect(within(card).getByText("R$10,083.41")).toBeInTheDocument();
    expect(within(card).getByText("R$30,000.00")).toBeInTheDocument();
    expect(within(card).getByText("R$19,916.59")).toBeInTheDocument();
    expect(within(card).getByText("06/30/2027")).toBeInTheDocument();
  });

  it("proposes the monthly amount that meets the due date and when it completes", async () => {
    await renderApp("/goals", { fetch: api([emergency]) });
    const card = await screen.findByRole("article", { name: "Emergency fund" });
    // 19,916.59 over the 8 months to June 2027, rounded up to the 50 step: 2,500.00 a month.
    expect(
      within(card).getByRole("slider", { name: catalogEn["goals.monthly"] }),
    ).toHaveValue("2500");
    expect(within(card).getByText("R$2,500.00")).toBeInTheDocument();
    expect(
      within(card).getByText("Ready in Jun 2027, on time"),
    ).toBeInTheDocument();
  });

  it("tags a reached goal and an overdue goal, and plans the goals that still have an amount left", async () => {
    await renderApp("/goals", { fetch: api([emergency, trip, laptop]) });
    const reached = await screen.findByRole("article", { name: "Trip" });
    expect(
      within(reached).getByText(catalogEn["goals.state.reached"]),
    ).toBeInTheDocument();
    expect(within(reached).queryByRole("slider")).toBeNull();
    const overdue = screen.getByRole("article", { name: "Laptop" });
    expect(
      within(overdue).getByText(catalogEn["goals.state.overdue"]),
    ).toBeInTheDocument();
  });

  it("counts the goals, the reached ones and the next due date", async () => {
    await renderApp("/goals", { fetch: api([emergency, trip, laptop]) });
    const figures = await screen.findByRole("region", {
      name: catalogEn["goals.figures"],
    });
    expect(within(figures).getByText("3")).toBeInTheDocument();
    expect(within(figures).getByText("1")).toBeInTheDocument();
    expect(within(figures).getByText("06/30/2027")).toBeInTheDocument();
  });

  it("invites the first goal when there are none", async () => {
    await renderApp("/goals", { fetch: api([]) });
    expect(
      await screen.findByText(catalogEn["goals.empty"]),
    ).toBeInTheDocument();
  });

  it("shows the aporte already scheduled into the goal and plans with it on request", async () => {
    await renderApp("/goals", { fetch: api([emergency], [savings]) });
    const card = await screen.findByRole("article", { name: "Emergency fund" });
    expect(
      await within(card).findByText("Scheduled: R$1,000.00 a month"),
    ).toBeInTheDocument();
    await userEvent.click(
      within(card).getByRole("button", {
        name: catalogEn["goals.useScheduled"],
      }),
    );
    expect(
      within(card).getByRole("slider", { name: catalogEn["goals.monthly"] }),
    ).toHaveValue("1000");
    // 19,916.59 left at 1,000.00 a month is 20 months: June 2028, 12 after the due month.
    expect(
      within(card).getByText("Ready in Jun 2028, 12 months late"),
    ).toBeInTheDocument();
  });

  it("offers a yearly return only for a goal that holds investments", async () => {
    await renderApp("/goals", { fetch: api([trip, portfolio]) });
    const plain = await screen.findByRole("article", { name: "Trip" });
    expect(
      within(plain).queryByRole("slider", { name: catalogEn["goals.return"] }),
    ).toBeNull();
    const invested = screen.getByRole("article", { name: "Portfolio" });
    expect(
      within(invested).getByRole("slider", { name: catalogEn["goals.return"] }),
    ).toHaveValue("0");
  });

  it("says which date the securities are valued at", async () => {
    await renderApp("/goals", { fetch: api([portfolio]) });
    const card = await screen.findByRole("article", { name: "Portfolio" });
    expect(
      within(card).getByText("Securities valued at the price of 10/16/2026"),
    ).toBeInTheDocument();
  });

  it("breaks a goal into the instruments it holds, with quantity, value and share", async () => {
    await renderApp("/goals", { fetch: api([portfolio, emergency]) });
    const card = await screen.findByRole("article", { name: "Portfolio" });
    await userEvent.click(
      within(card).getByRole("button", { name: catalogEn["goals.parts"] }),
    );
    const rows = within(card).getAllByRole("listitem");
    const [cash, shares] = rows as [HTMLElement, HTMLElement];
    expect(rows).toHaveLength(2);
    expect(within(cash).getByText("Corretora")).toBeInTheDocument();
    expect(within(cash).getByText("R$5,041.71")).toBeInTheDocument();
    expect(within(cash).getByText("50%")).toBeInTheDocument();
    expect(within(shares).getByText("PETR4")).toBeInTheDocument();
    expect(within(shares).getByText("100 PETR4")).toBeInTheDocument();
    expect(within(shares).getByText("R$5,041.70")).toBeInTheDocument();
  });

  it("does not break a goal that holds a single cash account", async () => {
    await renderApp("/goals", { fetch: api([emergency]) });
    const card = await screen.findByRole("article", { name: "Emergency fund" });
    expect(
      within(card).queryByRole("button", { name: catalogEn["goals.parts"] }),
    ).toBeNull();
  });

  it("offers the return the goal's accounts achieved and applies it on request", async () => {
    const earned = {
      ...portfolio,
      trailing_return: { period_months: 12, annual_bp: 840 },
    };
    await renderApp("/goals", { fetch: api([earned]) });
    const card = await screen.findByRole("article", { name: "Portfolio" });
    expect(within(card).getByText("Last 12 months: 8.4%")).toBeInTheDocument();
    await userEvent.click(
      within(card).getByRole("button", {
        name: catalogEn["goals.useTrailing"],
      }),
    );
    expect(
      within(card).getByRole("slider", { name: catalogEn["goals.return"] }),
    ).toHaveValue("8.5");
  });

  it("offers no return when the goal has none", async () => {
    await renderApp("/goals", { fetch: api([portfolio]) });
    const card = await screen.findByRole("article", { name: "Portfolio" });
    expect(
      within(card).queryByRole("button", {
        name: catalogEn["goals.useTrailing"],
      }),
    ).toBeNull();
  });
});
