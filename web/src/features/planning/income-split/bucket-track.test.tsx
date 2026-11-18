import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
    unallocated: money(received - needs - free - (m === "2026-10" ? 1500 : 0)),
    retained: money(0),
    buckets: [
      {
        id: buckets[0]?.id ?? "",
        real: money(needs),
        goal_paid: money(0),
        covered: money(0),
      },
      {
        id: buckets[1]?.id ?? "",
        real: money(free),
        goal_paid: money(0),
        covered: money(0),
      },
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
    // Planning coherence A258: each target states its base.
    expect(
      screen.getByText("target R$3,000.00 · 60.0% of R$5,000.00"),
    ).toBeVisible();

    // Section 6: the month as one strip that sums to the income received.
    const strip = screen.getByRole("group", {
      name: "Where the R$5,000.00 of the month went",
    });
    expect(
      within(strip)
        .getAllByRole("definition")
        .map((d) => d.textContent),
    ).toEqual(["R$3,200.00", "R$1,800.00", "R$15.00", "−R$15.00"]);
    expect(
      within(strip).getByRole("link", { name: "Set aside" }),
    ).toHaveAttribute("href", "/portfolio/contribution-plan");

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

  it("states the unallocated income of the month, positive, negative or absent at zero", async () => {
    const withRest = (unallocated: number) => ({
      ...history,
      months: history.months.map((m) =>
        m.month === "2026-10" ? { ...m, unallocated: money(unallocated) } : m,
      ),
    });
    const view = await renderApp(october, {
      fetch: budgetApi({
        "GET /api/v1/budget-buckets/history": () => json(200, withRest(120000)),
      }),
      today,
    });
    await section();

    expect(
      screen.getByText(
        "R$1,200.00 of the income of October went to no bucket, by purchase date.",
      ),
    ).toBeVisible();
    view.unmount();

    const negative = await renderApp(october, {
      fetch: budgetApi({
        "GET /api/v1/budget-buckets/history": () => json(200, withRest(-21300)),
      }),
      today,
    });
    await section();

    expect(
      screen.getByText(
        "R$213.00 above the income of October was spent or set aside, by purchase date.",
      ),
    ).toBeVisible();
    negative.unmount();

    await renderApp(october, {
      fetch: budgetApi({
        "GET /api/v1/budget-buckets/history": () => json(200, withRest(0)),
      }),
      today,
    });
    await section();

    expect(screen.queryByText(/stayed in the accounts/)).toBeNull();
    expect(screen.queryByText(/paid from balances/)).toBeNull();
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

describe("Entries of a bucket", () => {
  const entries = {
    currency: "BRL",
    total: money(3000),
    entries: [
      ["t1", "Market", "2026-10-03", 1200],
      ["t2", "", "2026-10-09", 800],
    ]
      .map(([id, payee, date, amount]) => ({
        transaction_id: `e0000000-0000-4000-8000-00000000000${String(id).slice(1)}`,
        kind: "savings",
        date,
        description: `${String(id)} description`,
        ...(payee === "" ? {} : { payee }),
        amount: money(Number(amount)),
      }))
      .concat([
        {
          transaction_id: "e0000000-0000-4000-8000-000000000003",
          kind: "expense",
          date: "2026-10-11",
          description: "Rent",
          amount: money(1000),
        },
      ] as never),
  };

  function setup() {
    const urls: string[] = [];
    const fetch = budgetApi({
      "GET /api/v1/budget-buckets/history": () => json(200, history),
      "GET /api/v1/budget-buckets/entries": (req) => {
        urls.push(new URL(req.url).search);
        return json(200, entries);
      },
    });
    return { fetch, urls };
  }

  it("opens the entries of a bucket from its name", async () => {
    const { fetch, urls } = setup();
    await renderApp(october, { fetch, today });
    await section();

    await userEvent.click(screen.getByRole("button", { name: "Needs" }));
    const drawer = await screen.findByRole("dialog");

    expect(await within(drawer).findByText("Savings")).toBeVisible();
    expect(within(drawer).getByText("R$20.00")).toBeVisible();
    expect(within(drawer).getByText("2 entries")).toBeVisible();
    expect(within(drawer).getByText("R$30.00")).toBeVisible();
    expect(within(drawer).getByText("R$200.00 over")).toBeVisible();
    expect(urls).toEqual([`?month=2026-10&bucket=${buckets[0]?.id ?? ""}`]);
  });

  it("opens the spending outside the split without a bucket", async () => {
    const { fetch, urls } = setup();
    await renderApp(october, { fetch, today });
    await section();

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["track.entries.see"] }),
    );
    await screen.findByRole("dialog");

    await vi.waitFor(() => {
      expect(urls).toEqual(["?month=2026-10"]);
    });
  });
});
