import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { portfolioApi, projectionPlan } from "@/testing/portfolio-api";
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
    expect(region.getByLabelText("Withdrawals from age")).toHaveValue("60");
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

    expect(
      await screen.findByText(catalogEn["portfolio.projection.plan.ageError"]),
    ).toBeInTheDocument();
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

    expect(region.getByLabelText("Withdrawals from age")).toHaveValue("");
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
    expect(
      within(region).getByText("Withdrawals from age"),
    ).toBeInTheDocument();
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
});
