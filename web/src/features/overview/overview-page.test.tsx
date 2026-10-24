import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { fakeApi, json, problem } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import {
  accountFixtures,
  accountRoutes,
  cardRoutes,
  reserveID,
  connectionFixture,
  checkingID,
  foodID,
  money,
} from "@/testing/account-api";
import {
  categories,
  budgets,
  foodBudget,
  fuelBudget,
  parkingBudget,
} from "@/testing/budget-api";
import { occurrence, salaryID, schedules } from "@/testing/planning-api";

const incomeID = "a1000000-0000-4000-8000-0000000000f1";
const accounts = [
  ...accountFixtures,
  {
    ...accountFixtures[0],
    id: incomeID,
    name: "Salário",
    class: "income",
    kind: undefined,
    institution_id: undefined,
  },
];

const categoryNames = [
  "Rent",
  "Food",
  "Fuel",
  "Health",
  "Gifts",
  "Travel",
  "Pets",
];
const categoryAccounts = categoryNames.map((name, i) => ({
  ...accountFixtures[0],
  id: `cat-${String(i)}`,
  name,
  class: "expense",
  kind: undefined,
  institution_id: undefined,
}));

function tx(postings: [string, number][]) {
  return {
    id: "t",
    date: "2026-10-05",
    postings: postings.map(([account_id, amount]) => ({
      account_id,
      amount: money(amount),
    })),
  };
}

function netWorth(req: Request) {
  const date = new URL(req.url).searchParams.get("date");
  // S129 at the end of September, 150.00 less than today.
  const assets = date === "2026-09-30" ? 205500 : 220500;
  return json(200, {
    assets: money(assets),
    liabilities: money(120000),
    net: money(assets - 120000),
  });
}

function api(overrides: Record<string, (req: Request) => Response> = {}) {
  return fakeApi({
    ...accountRoutes({
      "GET /api/v1/accounts": () =>
        json(200, { items: [...accounts, ...categoryAccounts] }),
    }),
    ...Object.fromEntries(
      accountFixtures.map((a) => [
        `GET /api/v1/accounts/${a.id}/projection`,
        () => json(200, { opening: money(0), points: [] }),
      ]),
    ),
    ...cardRoutes(),
    ...Object.fromEntries(
      accountFixtures.flatMap((a) => [
        [`GET /api/v1/accounts/${a.id}/reconciliation`, () => json(200, {})],
        [
          `GET /api/v1/accounts/${a.id}/unconfirmed`,
          () => json(200, { items: [] }),
        ],
      ]),
    ),
    "GET /api/v1/schedules": () => json(200, { items: schedules }),
    "GET /api/v1/occurrences": () => json(200, { items: [] }),
    "GET /api/v1/budgets": () => json(200, { items: [] }),
    "GET /api/v1/commitments": () =>
      json(200, {
        month: "2026-10",
        installments: money(100000),
        occurrences: money(200000),
        total: money(300000),
      }),
    "GET /api/v1/reports/net-worth": netWorth,
    "GET /api/v1/reports/categories": () =>
      json(200, {
        items: categoryAccounts.map((a, i) => ({
          account_id: a.id,
          total: money((i + 1) * 1000),
          subtree_total: money((i + 1) * 1000),
        })),
      }),
    "GET /api/v1/transactions": () =>
      json(200, {
        items: [
          tx([
            [checkingID, 100000],
            [incomeID, -100000],
          ]),
          tx([
            [checkingID, -2500],
            [foodID, 2500],
          ]),
        ],
      }),
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
});

function block(name: string) {
  return screen.getByRole("region", { name });
}

describe("overview page", () => {
  it("S129: shows assets, liabilities, net and the change against the previous month end", async () => {
    await renderApp("/", { width: 800, fetch: api() });
    const worth = await screen.findByRole("region", { name: "Net worth" });
    await waitFor(() => {
      expect(worth).toHaveTextContent("2,205.00");
    });
    expect(worth).toHaveTextContent("1,200.00");
    expect(worth).toHaveTextContent("1,005.00");
    expect(worth).toHaveTextContent("+17.5%");
  });

  it("shows the income, outflow and result of the month", async () => {
    await renderApp("/", { width: 800, fetch: api() });
    const flows = await screen.findByRole("region", { name: "Month flows" });
    await waitFor(() => {
      expect(flows).toHaveTextContent("1,000.00");
    });
    expect(flows).toHaveTextContent("25.00");
    expect(flows).toHaveTextContent("975.00");
  });

  it("lists the five largest categories of the month", async () => {
    await renderApp("/", { width: 800, fetch: api() });
    const spending = await screen.findByRole("region", {
      name: "Spending by category",
    });
    await waitFor(() => {
      expect(within(spending).getAllByRole("listitem")).toHaveLength(5);
    });
    const names = within(spending)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(names[0]).toContain("Pets");
    expect(names[4]).toContain("Fuel");
    expect(spending).not.toHaveTextContent("Rent");
    expect(spending).not.toHaveTextContent("Food");
  });

  it("keeps the other blocks when one operation fails", async () => {
    await renderApp("/", {
      width: 800,
      fetch: api({
        "GET /api/v1/reports/net-worth": () => problem(500, "internal_error"),
      }),
    });
    const worth = await screen.findByRole("region", { name: "Net worth" });
    await within(worth).findByRole("button", { name: "Try again" });
    const spending = await screen.findByRole("region", {
      name: "Spending by category",
    });
    await waitFor(() => {
      expect(spending).toHaveTextContent("Pets");
    });
  });

  it("masks every amount in privacy mode", async () => {
    hideAmounts();
    const { container } = await renderApp("/", { width: 800, fetch: api() });
    const spending = await screen.findByRole("region", {
      name: "Spending by category",
    });
    await waitFor(() => {
      expect(spending).toHaveTextContent("Pets");
    });
    await waitFor(() => {
      expect(block("Net worth")).toHaveTextContent("•");
    });
    expectNoAmounts(container, ["2,205.00", "1,005.00", "975.00"]);
  });

  it("puts the attention list before the figures on a phone", async () => {
    await renderApp("/", { fetch: api(), width: 390 });
    const attention = await screen.findByRole("region", { name: "Attention" });
    const worth = await screen.findByRole("region", { name: "Net worth" });
    expect(
      attention.compareDocumentPosition(worth) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  describe("second row", () => {
    const upcoming = [
      occurrence(
        "1",
        "e1000000-0000-4000-8000-000000000001",
        "2026-09-05",
        210000,
        "overdue",
      ),
      occurrence(
        "2",
        "e1000000-0000-4000-8000-000000000001",
        "2026-10-05",
        210000,
        "overdue",
      ),
      occurrence("4", salaryID, "2026-10-20", 500000, "expected"),
      occurrence("5", salaryID, "2026-10-30", 500000, "expected"),
    ];
    const progress: Record<string, [number, number]> = {
      [foodBudget.id]: [180000, 190000],
      [fuelBudget.id]: [40000, 36000],
      [parkingBudget.id]: [10000, 4000],
    };
    const goal = {
      id: "g1",
      name: "Trip",
      target: money(1000000),
      due_on: "2027-06-01",
      account_ids: [],
      current: money(250000),
      remaining: money(750000),
      progress_bp: 2500,
    };
    const full = () =>
      api({
        "GET /api/v1/accounts": () =>
          json(200, {
            items: [...accounts, ...categoryAccounts, ...categories],
          }),
        "GET /api/v1/occurrences": () => json(200, { items: upcoming }),
        "GET /api/v1/budgets": () => json(200, { items: budgets }),
        "GET /api/v1/goals": () => json(200, { items: [goal] }),
        ...Object.fromEntries(
          [foodBudget, fuelBudget, parkingBudget].map((b) => [
            `GET /api/v1/budgets/${b.id}/progress`,
            () => {
              const [planned, spent] = progress[b.id] ?? [0, 0];
              return json(200, {
                month: "2026-10",
                planned: money(planned),
                carried: money(0),
                spent: money(spent),
                available: money(planned - spent),
              });
            },
          ]),
        ),
      });

    it("lists the overdue occurrences and those of the next 7 days", async () => {
      await renderApp("/", { fetch: full() });
      const region = await screen.findByRole("region", { name: "Upcoming" });
      await waitFor(() => {
        expect(within(region).getAllByRole("listitem")).toHaveLength(3);
      });
      expect(region).toHaveTextContent("Rent");
      expect(region).toHaveTextContent("Salary");
    });

    it("lists the open and the unpaid closed statements with amount and due date", async () => {
      await renderApp("/", { fetch: full() });
      const region = await screen.findByRole("region", { name: "Cards" });
      await waitFor(() => {
        expect(within(region).getAllByRole("listitem")).toHaveLength(2);
      });
      expect(region).toHaveTextContent("1,800.00");
      expect(region).toHaveTextContent("2,500.00");
    });

    it("lists the overspent and the near-limit budgets only", async () => {
      await renderApp("/", { fetch: full() });
      const region = await screen.findByRole("region", { name: "Budgets" });
      await waitFor(() => {
        expect(within(region).getAllByRole("listitem")).toHaveLength(2);
      });
      expect(region).toHaveTextContent("Food");
      expect(region).toHaveTextContent("Fuel");
      expect(region).not.toHaveTextContent("Parking");
    });

    it("shows the progress of each goal", async () => {
      await renderApp("/", { fetch: full() });
      const region = await screen.findByRole("region", { name: "Goals" });
      await waitFor(() => {
        expect(region).toHaveTextContent("Trip");
      });
      expect(region).toHaveTextContent("25%");
    });

    it("keeps the goals when the occurrences fail", async () => {
      await renderApp("/", {
        fetch: api({
          "GET /api/v1/occurrences": () => problem(500, "internal_error"),
          "GET /api/v1/goals": () => json(200, { items: [goal] }),
        }),
      });
      const upcomingRegion = await screen.findByRole("region", {
        name: "Upcoming",
      });
      await within(upcomingRegion).findByRole("button", { name: "Try again" });
      const goals = await screen.findByRole("region", { name: "Goals" });
      await waitFor(() => {
        expect(goals).toHaveTextContent("Trip");
      });
    });
  });

  describe("attention list", () => {
    const uncategorized = (items: unknown[]) => (req: Request) =>
      new URL(req.url).searchParams.get("uncategorized") === "true"
        ? json(200, { items })
        : json(200, { items: [] });
    const stuck = { ...connectionFixture, state: "failed" };
    const reconciliation = {
      open_difference: {
        assertion_id: "as1",
        date: "2026-10-15",
        difference: money(-1500),
      },
    };

    it("counts what needs a decision and links each count", async () => {
      await renderApp("/", {
        fetch: api({
          "GET /api/v1/transactions": uncategorized([{}, {}, {}]),
          [`GET /api/v1/accounts/${checkingID}/unconfirmed`]: () =>
            json(200, { items: [{}, {}] }),
          "GET /api/v1/connections": () =>
            json(200, { items: [connectionFixture, stuck] }),
          [`GET /api/v1/accounts/${reserveID}/reconciliation`]: () =>
            json(200, reconciliation),
        }),
      });
      const region = await screen.findByRole("region", { name: "Attention" });
      await waitFor(() => {
        expect(within(region).getAllByRole("listitem")).toHaveLength(4);
      });
      const rows = within(region)
        .getAllByRole("listitem")
        .map((row) => row.textContent);
      expect(rows[0]).toMatch(/Uncategorized transactions.*3/);
      expect(rows[1]).toMatch(/Unconfirmed records.*Nubank.*2/);
      expect(rows[2]).toMatch(/Connections that need action.*1/);
      expect(rows[3]).toMatch(/Reserva de emergência.*15\.00/);
      expect(
        within(region)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      ).toEqual(
        expect.arrayContaining([
          "/transactions?uncategorized=true",
          "/accounts/links",
          `/accounts/${reserveID}?tab=reconciliation`,
        ]),
      );
    });

    it("draws no block when nothing needs attention", async () => {
      await renderApp("/", {
        fetch: api({ "GET /api/v1/transactions": uncategorized([]) }),
      });
      await waitFor(() => {
        expect(screen.getByRole("region", { name: "Goals" })).toHaveTextContent(
          "No goals yet",
        );
      });
      await waitFor(() => {
        expect(screen.queryByRole("region", { name: "Attention" })).toBeNull();
      });
    });

    it("fails alone when the connections cannot be read", async () => {
      await renderApp("/", {
        width: 800,
        fetch: api({
          "GET /api/v1/connections": () => problem(500, "internal_error"),
        }),
      });
      const region = await screen.findByRole("region", { name: "Attention" });
      await within(region).findByRole("button", { name: "Try again" });
      await waitFor(() => {
        expect(block("Net worth")).toHaveTextContent("2,205.00");
      });
    });
  });

  describe("desktop", () => {
    const projection = {
      [`GET /api/v1/accounts/${checkingID}/projection`]: () =>
        json(200, {
          opening: money(524055),
          points: [
            {
              date: "2026-10-25",
              occurrence_id: "o1",
              schedule_id: "e1000000-0000-4000-8000-000000000001",
              amount: money(-210000),
            },
          ],
        }),
    };

    it("leads with net worth, month result, month-end balance and committed", async () => {
      await renderApp("/", { fetch: api(projection) });
      const figures = await screen.findByRole("region", {
        name: "Overview figures",
      });
      await waitFor(() => {
        expect(figures).toHaveTextContent("3,140.55");
      });
      expect(figures).toHaveTextContent("1,005.00");
      expect(figures).toHaveTextContent("975.00");
      expect(figures).toHaveTextContent("3,000.00");
    });

    it("draws the balance of the month as a chart", async () => {
      await renderApp("/", { fetch: api(projection) });
      expect(await screen.findByText("Balance of the month")).toBeVisible();
    });

    it("masks the figures in privacy mode", async () => {
      hideAmounts();
      const { container } = await renderApp("/", { fetch: api(projection) });
      await screen.findByText("Balance of the month");
      await waitFor(() => {
        expect(
          screen.getByRole("region", { name: "Overview figures" }),
        ).toHaveTextContent("•");
      });
      expectNoAmounts(container, ["3,140.55", "1,005.00", "975.00"]);
    });

    it("keeps the attention list to four rows and counts the rest", async () => {
      await renderApp("/", {
        fetch: api({
          "GET /api/v1/transactions": (req) =>
            new URL(req.url).searchParams.get("uncategorized") === "true"
              ? json(200, { items: [{}, {}, {}] })
              : json(200, { items: [] }),
          [`GET /api/v1/accounts/${checkingID}/unconfirmed`]: () =>
            json(200, { items: [{}, {}] }),
          [`GET /api/v1/accounts/${reserveID}/unconfirmed`]: () =>
            json(200, { items: [{}] }),
          "GET /api/v1/connections": () =>
            json(200, { items: [{ ...connectionFixture, state: "failed" }] }),
          [`GET /api/v1/accounts/${reserveID}/reconciliation`]: () =>
            json(200, {
              open_difference: {
                assertion_id: "as1",
                date: "2026-10-15",
                difference: money(-1500),
              },
            }),
        }),
      });
      const region = await screen.findByRole("region", { name: "Attention" });
      await waitFor(() => {
        expect(within(region).getAllByRole("listitem")).toHaveLength(5);
      });
      expect(region).toHaveTextContent("1 more");
    });
  });
});
