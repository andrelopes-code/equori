import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import {
  historySeries,
  portfolioApi,
  projectionPlan,
} from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const me = {
  id: 1,
  email: "a@b.c",
  books_id: 1,
  role: "admin",
  book_role: "owner",
  language: "en",
  birth_date: "1994-03-10",
};

const withBirth = { "GET /api/v1/me": () => json(200, me) };

// Twelve months and more: from 2024-11-01 to 2025-12-31, 10% against 5% of inflation.
const yearSeries = {
  from: "2024-11-01",
  to: "2025-12-31",
  currency: "BRL",
  opening: 100000,
  points: [{ date: "2025-12-31", value: 110000, flows: 0, return_bp: 1000 }],
  indexes: [
    {
      index: "ipca",
      period: "month",
      points: [{ date: "2025-12-31", return_bp: 500 }],
    },
  ],
};

const planName = catalogEn["portfolio.projection.plan.title"];

// A plan with no return and no inflation: its line grows by the contribution alone.
const noReturnPlan = {
  ...projectionPlan,
  real_return_bp: 0,
  inflation_bp: 0,
  changes: [{ month: "2025-11-01", amount: 100000 }],
  baseline: { date: "2025-11-20", value: 1000000 },
};

// The line starts on 10,000.00 in October and takes the recorded 500.00 of November, the baseline
// month: 10,500.00. After it the plan adds 1,000.00 a month: 11,500.00 against 11,600.00 recorded,
// then 12,500.00 against 11,800.00. The real return is 1.13 over 1.05, in 457 days.
const versusSeries = {
  from: "2024-11-01",
  to: "2026-01-31",
  currency: "BRL",
  opening: 1000000,
  points: [
    { date: "2025-10-31", value: 1000000, flows: 0, return_bp: 0 },
    { date: "2025-11-30", value: 1050000, flows: 50000, return_bp: 0 },
    { date: "2025-12-31", value: 1160000, flows: 100000, return_bp: 1000 },
    { date: "2026-01-31", value: 1180000, flows: 80000, return_bp: 1300 },
  ],
  indexes: [
    {
      index: "ipca",
      period: "month",
      points: [
        { date: "2025-12-31", return_bp: 500 },
        { date: "2026-01-31", return_bp: 500 },
      ],
    },
  ],
};

// The plan section once its reads are done: the pending section shares its name.
async function planRegion() {
  await waitFor(() => {
    expect(screen.getByRole("region", { name: planName })).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  return screen.getByRole("region", { name: planName });
}

describe("Portfolio projection page", () => {
  it("PX1: lists five tabs with the projection last and selected", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi(withBirth),
    });
    const list = await screen.findByRole("tablist", {
      name: catalogEn["portfolio.tabs.label"],
    });

    expect(
      within(list)
        .getAllByRole("tab")
        .map((e) => e.textContent),
    ).toEqual([
      catalogEn["portfolio.tabs.results"],
      catalogEn["portfolio.tabs.positions"],
      catalogEn["portfolio.tabs.year"],
      catalogEn["portfolio.tabs.contributions"],
      catalogEn["portfolio.tabs.projection"],
    ]);
    expect(
      within(list).getByRole("tab", {
        name: catalogEn["portfolio.tabs.projection"],
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("PX2: draws the age and the fields of the stored plan", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi(withBirth),
    });
    const region = within(await planRegion());

    expect(await region.findByText("32 years")).toBeInTheDocument();
    expect(region.getByLabelText("Withdrawals at")).toHaveValue("60");
    expect(region.getByLabelText("Real return")).toHaveValue("4.00");
    expect(region.getByLabelText("Inflation")).toHaveValue("4.50");
    expect(region.getByLabelText("Until age")).toHaveValue("90");
    expect(region.queryByText(/^Portfolio: /)).toBeNull();
  });

  it("PX2: states the realized real return when the history holds 12 months", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/reports/return/series": () => json(200, yearSeries),
      }),
    });

    expect(
      await screen.findByText("Portfolio: 4.1% a year"),
    ).toBeInTheDocument();
  });

  it("PX2: saves the plan as typed", async () => {
    const bodies: unknown[] = [];
    const fetch = portfolioApi({
      ...withBirth,
      "PUT /api/v1/portfolio-projection": async (req) => {
        bodies.push(await req.json());
        return json(200, projectionPlan);
      },
    });
    await renderApp("/portfolio/projection", { fetch });
    const region = within(await planRegion());
    const field = await region.findByLabelText("Real return");

    await userEvent.clear(field);
    await userEvent.type(field, "5,5");
    await userEvent.click(region.getByRole("button", { name: "Save plan" }));

    await waitFor(() => {
      expect(bodies).toEqual([
        {
          withdrawal_age: 60,
          last_age: 90,
          real_return_bp: 550,
          inflation_bp: 450,
          withdrawal: { mode: "income", income: 500000 },
          changes: projectionPlan.changes,
        },
      ]);
    });
  });

  it("PX2: shows the message of a 422 in a notice", async () => {
    const fetch = portfolioApi({
      ...withBirth,
      "PUT /api/v1/portfolio-projection": () =>
        problem(422, "projection_past_change"),
    });
    await renderApp("/portfolio/projection", { fetch });
    const region = within(await planRegion());

    await userEvent.click(
      await region.findByRole("button", { name: "Save plan" }),
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("PX2: a withdrawal age at or below the current age shows its error", async () => {
    const early = { ...projectionPlan, withdrawal_age: 32 };
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () => json(200, early),
      }),
    });

    // The member of the fixture is 32: the text names the age to pass, on one line of the field.
    expect(await screen.findByText("Above age 32")).toBeInTheDocument();
  });

  it("PJ1: a field outside its range states the range and holds the save", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi(withBirth),
    });
    const region = within(await planRegion());
    const inflation = region.getByLabelText("Inflation");

    await userEvent.clear(inflation);
    await userEvent.type(inflation, "51");

    expect(region.getByText("From 0 to 50")).toBeInTheDocument();
    expect(region.getByRole("button", { name: "Save plan" })).toBeDisabled();
  });

  it("offers the trade only when the history holds a portfolio", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/reports/return/series": () =>
          json(200, { ...historySeries, points: [] }),
      }),
    });
    await planRegion();

    expect(
      screen.queryByRole("link", { name: catalogEn["holdings.trade"] }),
    ).toBeNull();
  });

  it("PX11: offers to build a projection when the member has none", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () => problem(404, "not_found"),
      }),
    });

    expect(
      await screen.findByText(catalogEn["portfolio.projection.empty.title"]),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: catalogEn["portfolio.projection.empty.build"],
      }),
    );
    const region = within(await planRegion());

    expect(region.getByLabelText("Withdrawals at")).toHaveValue("");
    expect(region.getByRole("button", { name: "Save plan" })).toBeDisabled();
  });

  it("PX11: states a failed read and reads again", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () =>
          problem(500, "internal_error"),
      }),
    });

    expect(
      await screen.findByRole("region", {
        name: catalogEn["portfolio.projection.failed"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: catalogEn["common.retry"] }),
    ).toBeInTheDocument();
  });

  it("PX11: keeps the static texts while the plan is pending", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () =>
          new Promise<Response>(() => undefined),
      }),
    });
    const region = await screen.findByRole("region", { name: planName });

    expect(region).toHaveAttribute("aria-busy", "true");
    expect(within(region).getByText("Withdrawals at")).toBeInTheDocument();
  });

  it("PX3: asks for the birth date and draws nothing below", async () => {
    await renderApp("/portfolio/projection", { fetch: portfolioApi() });
    const region = within(await planRegion());

    expect(
      await screen.findByText(catalogEn["portfolio.projection.nobirth.title"]),
    ).toBeInTheDocument();
    expect(region.getByText("Birth date")).toBeInTheDocument();
    expect(region.queryByText("Age")).toBeNull();
  });

  it("PX12: states the currency change and deletes the plan", async () => {
    let deleted = 0;
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () =>
          json(200, { ...projectionPlan, currency: "USD" }),
        "DELETE /api/v1/portfolio-projection": () => {
          deleted += 1;
          return new Response(null, { status: 204 });
        },
      }),
    });

    expect(
      await screen.findByText(catalogEn["portfolio.projection.currency.title"]),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Plan" })).toBeNull();

    await userEvent.click(
      screen.getByRole("button", {
        name: catalogEn["portfolio.projection.currency.delete"],
      }),
    );

    await waitFor(() => {
      expect(deleted).toBe(1);
    });
  });

  it("PX3: writes the birth date chosen to the profile", async () => {
    const bodies: unknown[] = [];
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        "PATCH /api/v1/me": async (req) => {
          bodies.push(await req.json());
          return json(200, me);
        },
      }),
    });
    const region = within(await planRegion());
    const [month = document.body, day = document.body, year = document.body] =
      region.getAllByRole("spinbutton");

    await userEvent.type(month, "03");
    await userEvent.type(day, "10");
    await userEvent.type(year, "1994");

    await waitFor(() => {
      expect(bodies).toEqual([{ birth_date: "1994-03-10" }]);
    });
  });

  it("PX6: states the plan that sustains the income, the way and the figures", async () => {
    const plan = {
      ...projectionPlan,
      withdrawal: { mode: "income", income: 100000 },
    };
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () => json(200, plan),
      }),
    });
    const journey = within(await journeyRegion());

    expect(
      journey.getByText(
        catalogEn["portfolio.projection.journey.verdict.sustains"],
      ),
    ).toBeInTheDocument();
    expect(journey.getByText("418% of the amount needed")).toBeInTheDocument();
    expect(
      journey.getByRole("img", { name: "0.49% of the way" }),
    ).toBeInTheDocument();
    // The approved mock writes the two amounts of the verdict in the compact form.
    expect(journey.getByText(/211\.28K needed at 60/)).toBeInTheDocument();
    expect(journey.getByText("R$883.34K")).toBeInTheDocument();
    // The summary of the plot: the area of the return ends where the withdrawals start.
    expect(
      journey.getByText(/Return: from .* up to R\$883\.34K at 2054 · age 60\./),
    ).toBeInTheDocument();
    for (const key of ["Recorded", "Projection", "Contributed", "Return"])
      expect(journey.getByText(key)).toBeInTheDocument();
    expect(fact("Needed at age 60")).toMatch(/211,281\.71$/);
    expect(fact("Contributed to age 60")).toMatch(/493,000\.00$/);
    expect(fact("Return to age 60")).toMatch(/^\+.*390,338\.51$/);
    expect(fact("Income the plan sustains")).toMatch(/4,180\.86 a month$/);
    expect(fact("Against the plan today")).toMatch(/^\u2212/);
  });

  it("PX6: states the age the income ends when the plan does not sustain it", async () => {
    const plan = {
      ...projectionPlan,
      withdrawal: { mode: "income", income: 5000000 },
    };
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () => json(200, plan),
      }),
    });
    const journey = within(await journeyRegion());

    expect(
      journey.getByText(
        catalogEn["portfolio.projection.journey.verdict.fails"],
      ),
    ).toBeInTheDocument();
    expect(
      journey.getByText(/lasts until age 61, not until age 90\./),
    ).toBeInTheDocument();
  });

  it("PX6: states the income of the rate and draws no amount needed", async () => {
    const plan = {
      ...projectionPlan,
      withdrawal: { mode: "rate", rate_bp: 400 },
    };
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () => json(200, plan),
      }),
    });
    const journey = within(await journeyRegion());

    expect(fact("Income the plan sustains")).toMatch(/2,944\.46 a month$/);
    expect(journey.queryByText("Needed at age 60")).toBeNull();
    expect(journey.queryByRole("img", { name: /of the way/ })).toBeNull();
    expect(
      journey.queryByText(
        catalogEn["portfolio.projection.journey.verdict.sustains"],
      ),
    ).toBeNull();
    expect(
      journey.queryByText(
        catalogEn["portfolio.projection.journey.verdict.fails"],
      ),
    ).toBeNull();
  });

  it("PX13: the description states a past without an inflation index", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi(withBirth),
    });
    const journey = within(await journeyRegion());

    expect(
      journey.getByText(
        "From 2025 to age 90, in today's money; the past in nominal values.",
      ),
    ).toBeInTheDocument();
  });

  it("PX6: the switch names the values the plot draws", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/reports/return/series": () => json(200, versusSeries),
      }),
    });
    const journey = within(await journeyRegion());

    expect(
      journey.getByText("From 2025 to age 90, in today's money."),
    ).toBeInTheDocument();

    await userEvent.click(journey.getByRole("radio", { name: "Nominal" }));

    expect(
      journey.getByText("From 2025 to age 90, in nominal values."),
    ).toBeInTheDocument();
  });

  it("PX7: draws the plan against the whole recorded history", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () => json(200, noReturnPlan),
        "GET /api/v1/reports/return/series": () => json(200, versusSeries),
      }),
    });
    const region = await versusRegion();
    const versus = within(region);

    expect(
      versus.getByText(
        "Recorded contributions at the plan's rate until Nov/2025, the plan after. Nominal values.",
      ),
    ).toBeInTheDocument();
    for (const key of ["Recorded", "Plan", "Above the plan", "Below the plan"])
      expect(versus.getByText(key)).toBeInTheDocument();
    // 11,800.00 recorded against 12,500.00 in January: 700.00 under, 5.60% of the line. Of the
    // three months after the first, only December is above.
    expect(tile(region, "Against the plan today")).toEqual([
      expect.stringMatching(/^\u2212.*700\.00$/),
      expect.stringMatching(/^\u22125\.60%$/),
    ]);
    expect(tile(region, "Months above the plan")[0]).toBe("1 of 3");
    expect(tile(region, "Average recorded contribution")).toEqual([
      expect.stringMatching(/900\.00$/),
      expect.stringMatching(/^plan: .*1,000\.00$/),
    ]);
    expect(tile(region, "Realized real return")).toEqual([
      "6.04% a year",
      "plan: 0.00% a year",
    ]);
  });

  it("PX7: compares a plan saved this month over the history before it", async () => {
    const saved = {
      ...noReturnPlan,
      baseline: { date: "2026-01-17", value: 1180000 },
    };
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () => json(200, saved),
        "GET /api/v1/reports/return/series": () => json(200, versusSeries),
      }),
    });
    const region = await versusRegion();

    // Every month takes its recorded flows: 10,000.00, 10,500.00, 11,500.00, 12,300.00 against
    // 11,800.00 recorded. No month runs under the plan yet.
    expect(tile(region, "Against the plan today")[0]).toMatch(
      /^\u2212.*500\.00$/,
    );
    expect(tile(region, "Months above the plan")[0]).toBe("1 of 3");
    expect(tile(region, "Average recorded contribution")[0]).toBe(
      "no month yet",
    );
  });

  it("PX7: states what the comparison needs under two recorded months", async () => {
    const short = { ...versusSeries, points: versusSeries.points.slice(0, 1) };
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () => json(200, noReturnPlan),
        "GET /api/v1/reports/return/series": () => json(200, short),
      }),
    });
    const versus = within(await versusRegion());

    expect(
      versus.getByText("The comparison needs two months of portfolio history."),
    ).toBeInTheDocument();
    expect(versus.queryByText("Months above the plan")).toBeNull();
  });

  it("PX7: draws no comparison while the member has no plan", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi({
        ...withBirth,
        "GET /api/v1/portfolio-projection": () => problem(404, "not_found"),
      }),
    });

    await screen.findByText(catalogEn["portfolio.projection.empty.title"]);
    await userEvent.click(
      screen.getByRole("button", {
        name: catalogEn["portfolio.projection.empty.build"],
      }),
    );
    await planRegion();

    expect(
      screen.queryByRole("region", {
        name: catalogEn["portfolio.projection.versus"],
      }),
    ).toBeNull();
  });

  it("PX10: draws twelve rows of the years and opens to all of them", async () => {
    await renderApp("/portfolio/projection", {
      fetch: portfolioApi(withBirth),
    });
    const years = within(await yearsRegion());

    expect(years.getAllByRole("rowheader")).toHaveLength(12);
    expect(
      years.getAllByRole("columnheader").map((e) => e.textContent),
    ).toEqual([
      "Year",
      "Age",
      "Contributions",
      "Return",
      "Withdrawals",
      "Contributed",
      "Value",
    ]);

    const more = years.getByRole("button", { name: /^Show the \d+ years$/ });
    const count = Number(/\d+/.exec(more.textContent)?.[0]);
    await userEvent.click(more);

    expect(years.getAllByRole("rowheader")).toHaveLength(count);
    expect(count).toBeGreaterThan(12);

    await userEvent.click(
      years.getByRole("button", {
        name: catalogEn["portfolio.projection.years.less"],
      }),
    );

    expect(years.getAllByRole("rowheader")).toHaveLength(12);
  });
});

async function journeyRegion() {
  return screen.findByRole("region", {
    name: catalogEn["portfolio.projection.journey"],
  });
}

// The value of the row of the journey's fact list that carries the label: the versus block
// repeats some labels.
function fact(label: string) {
  const journey = screen.getByRole("region", {
    name: catalogEn["portfolio.projection.journey"],
  });

  return (
    within(journey).getByText(label).closest("div")?.querySelector("dd")
      ?.textContent ?? ""
  );
}

async function yearsRegion() {
  return screen.findByRole("region", {
    name: catalogEn["portfolio.projection.years"],
  });
}

async function versusRegion() {
  return screen.findByRole("region", {
    name: catalogEn["portfolio.projection.versus"],
  });
}

// The texts of the value and of the note of a tile of the row.
function tile(region: HTMLElement, label: string) {
  const dds = within(region)
    .getByText(label)
    .closest("div")
    ?.querySelectorAll("dd");

  return [...(dds ?? [])].map((dd) => dd.textContent);
}
