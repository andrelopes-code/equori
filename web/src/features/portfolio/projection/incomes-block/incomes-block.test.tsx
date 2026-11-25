import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
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

// No return, no inflation and no contribution: 1,000,000.00 at age 60 pays 360 months.
const plan = {
  ...projectionPlan,
  real_return_bp: 0,
  inflation_bp: 0,
  changes: [{ month: "2025-11-01", amount: 0 }],
};

const history = {
  from: "2025-11-01",
  to: "2026-09-30",
  currency: "BRL",
  opening: 100000000,
  points: [{ date: "2026-09-30", value: 100000000, flows: 0, return_bp: 0 }],
  indexes: [],
};

const pension = { name: "Pension", amount: 300000, start_age: 60 };
const rent = { name: "Rent", amount: 100000, start_age: 70, end_age: 80 };

const add = catalogEn["portfolio.projection.incomes.add"];

async function block(patch: object = {}, bodies: unknown[] = []) {
  const stored = { ...plan, ...patch };
  await renderApp("/portfolio/projection", {
    fetch: portfolioApi({
      "GET /api/v1/me": () => json(200, me),
      "GET /api/v1/portfolio-projection": () => json(200, stored),
      "GET /api/v1/reports/return/series": () => json(200, history),
      "PUT /api/v1/portfolio-projection": async (req) => {
        bodies.push(await req.json());

        return json(200, stored);
      },
    }),
  });

  return within(
    await screen.findByRole("region", {
      name: catalogEn["portfolio.projection.incomes"],
    }),
  );
}

function row(region: Awaited<ReturnType<typeof block>>, name: string) {
  return within(region.getByRole("row", { name: new RegExp(`^${name}`) }))
    .getAllByRole("cell")
    .map((cell) => cell.textContent.replace(/\u00a0/g, " "));
}

describe("Incomes block", () => {
  it("PX21: draws only the action while the plan has no other income", async () => {
    const region = await block();

    expect(region.getByRole("button", { name: add })).toBeEnabled();
    expect(region.queryByRole("table")).toBeNull();
    expect(region.queryByRole("list")).toBeNull();
    expect(screen.getByText("Net of other income.")).toBeInTheDocument();
  });

  it("PX21: states the plan with and without its other incomes", async () => {
    const region = await block({ incomes: [pension, rent] });

    expect(region.getByText("from age 60")).toBeInTheDocument();
    expect(region.getByText("from age 70 to 80")).toBeInTheDocument();
    // 5,000.00 a month: 360 * 2,000.00 - 120 * 1,000.00 = 600,000.00 from the portfolio; without
    // the list 1,800,000.00, of which 1,000,000.00 is 55.6%. Sustained: 360 X - 1,080,000.00 -
    // 120,000.00 = 1,000,000.00; without, 1,000,000.00 / 360.
    expect(row(region, "With other incomes")).toEqual([
      "R$600,000.00",
      "166%",
      "R$6,111.11 a month",
      "lasts to 90",
    ]);
    expect(row(region, "Without other incomes")).toEqual([
      "R$1,800,000.00",
      "55%",
      "R$2,777.78 a month",
      "ends at 76",
    ]);
    expect(
      screen.getByText(catalogEn["portfolio.projection.plan.incomeTotal"]),
    ).toBeInTheDocument();
  });

  it("PX20: says the other incomes cover the income in place of a share", async () => {
    const region = await block({
      incomes: [{ ...pension, amount: 500000 }],
    });

    expect(row(region, "With other incomes")[1]).toBe("covered");
    expect(
      screen.getByText(/The other incomes cover .* a month until age 90\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^0% of the amount needed$/)).toBeNull();
  });

  it("PX21: states the total income per range of ages in rate mode", async () => {
    const region = await block({
      withdrawal: { mode: "rate", rate_bp: 120 },
      incomes: [pension, rent],
    });

    // 1,000,000.00 * 1.2% / 12 = 1,000.00 a month.
    expect(row(region, "from age 60 to 70")).toEqual(["R$4,000.00 a month"]);
    expect(row(region, "from age 70 to 80")).toEqual(["R$5,000.00 a month"]);
    expect(row(region, "from age 80 to 90")).toEqual(["R$4,000.00 a month"]);
  });

  it("PX21: adds an income to the draft, ordered by age, and the save carries it", async () => {
    const bodies: unknown[] = [];
    const region = await block({ incomes: [rent] }, bodies);

    await userEvent.click(region.getByRole("button", { name: add }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));

    expect(dialog.getByText("Enter the name.")).toBeInTheDocument();
    expect(dialog.getByText("Enter an amount above zero.")).toBeInTheDocument();
    expect(dialog.getByText("From 18 to 120")).toBeInTheDocument();

    await userEvent.type(dialog.getByLabelText("Name"), "Pension");
    await userEvent.type(dialog.getByLabelText("Amount a month"), "300000");
    await userEvent.type(dialog.getByLabelText("From age"), "60");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await userEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({ incomes: [pension, rent] });
  });

  it("PX21: edits an income and removes it", async () => {
    const bodies: unknown[] = [];
    const region = await block({ incomes: [pension, rent] }, bodies);

    await userEvent.click(region.getByRole("button", { name: "Change Rent" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.clear(dialog.getByLabelText("Until age"));
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    expect(await region.findByText("from age 70")).toBeInTheDocument();
    await userEvent.click(
      region.getByRole("button", { name: "Change Pension" }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Remove income",
      }),
    );
    await waitFor(() => {
      expect(region.queryByText("Pension")).toBeNull();
    });
    await userEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({
      incomes: [{ name: "Rent", amount: 100000, start_age: 70 }],
    });
  });

  it("PJ8: at 20 incomes the action is disabled with its reason", async () => {
    const region = await block({
      incomes: Array.from({ length: 20 }, () => pension),
    });

    expect(region.getByRole("button", { name: add })).toBeDisabled();
    expect(
      region.getByText(catalogEn["portfolio.projection.incomes.add.full"]),
    ).toBeInTheDocument();
  });
});
