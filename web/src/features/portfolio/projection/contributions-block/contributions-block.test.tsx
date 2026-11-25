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

// Today is 2026-10-17 in the harness: the first change is past, the others are not.
const changes = [
  { month: "2026-06-01", amount: 100000 },
  { month: "2026-11-01", amount: 200000 },
];

const history = {
  from: "2025-11-01",
  to: "2026-09-30",
  currency: "BRL",
  opening: 100000,
  points: [
    { date: "2026-09-30", value: 1000000, flows: 100000, return_bp: 500 },
  ],
  indexes: [],
};

const title = catalogEn["portfolio.projection.contributions"];
const add = catalogEn["portfolio.projection.contributions.add"];

function api(planChanges = changes, bodies: unknown[] = []) {
  const plan = { ...projectionPlan, changes: planChanges };

  return portfolioApi({
    "GET /api/v1/me": () => json(200, me),
    "GET /api/v1/portfolio-projection": () => json(200, plan),
    "GET /api/v1/reports/return/series": () => json(200, history),
    "PUT /api/v1/portfolio-projection": async (req) => {
      bodies.push(await req.json());

      return json(200, plan);
    },
  });
}

async function block(planChanges = changes, bodies: unknown[] = []) {
  await renderApp("/portfolio/projection", { fetch: api(planChanges, bodies) });

  return within(await screen.findByRole("region", { name: title }));
}

async function openAdd() {
  await userEvent.click(await screen.findByRole("button", { name: add }));

  return within(await screen.findByRole("dialog"));
}

describe("Contributions block", () => {
  it("PX8: lists the changes newest last and gives a past one no action", async () => {
    const region = await block();

    expect(await region.findByText("since Jun/2026")).toBeInTheDocument();
    expect(region.getByText("from Nov/2026")).toBeInTheDocument();
    expect(
      region.getAllByRole("button", { name: /^Change contribution/ }),
    ).toHaveLength(1);
    expect(
      region.getByRole("button", { name: "Change contribution from Nov/2026" }),
    ).toBeInTheDocument();
  });

  it("PX8: nine changes keep the list apart from the add action", async () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({
      month: `2027-${String(i + 1).padStart(2, "0")}-01`,
      amount: 100000 + i,
    }));
    const region = await block(nine);
    const list = (await region.findByText("since Jan/2027")).closest("ul");

    expect(list).not.toBeNull();
    if (list === null) return;

    expect(within(list).getAllByRole("listitem")).toHaveLength(9);
    expect(within(list).queryByRole("button", { name: add })).toBeNull();
    expect(region.getByRole("button", { name: add })).toBeEnabled();
  });

  it("PJ2: at 40 changes the add action is disabled with its reason", async () => {
    const forty = Array.from({ length: 40 }, (_, i) => ({
      month: `${String(2027 + Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, "0")}-01`,
      amount: 100000,
    }));
    const region = await block(forty);

    expect(await region.findByRole("button", { name: add })).toBeDisabled();
    expect(
      region.getByText(
        catalogEn["portfolio.projection.contributions.add.full"],
      ),
    ).toBeInTheDocument();
  });

  it("PX9: adds a change to the draft and the save carries it", async () => {
    const bodies: unknown[] = [];
    const region = await block(changes, bodies);
    const dialog = await openAdd();

    await userEvent.type(
      dialog.getByLabelText("Contribution a month"),
      "300000",
    );

    expect(
      dialog.getByText(/With this change the plan reaches/),
    ).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(region.getByText("from Dec/2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({
      changes: [...changes, { month: "2026-12-01", amount: 300000 }],
    });
  });

  it("PX9: edits a change and removes it", async () => {
    const bodies: unknown[] = [];
    const region = await block(changes, bodies);

    await userEvent.click(
      await region.findByRole("button", {
        name: "Change contribution from Nov/2026",
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    const amount = dialog.getByLabelText("Contribution a month");

    await userEvent.clear(amount);
    await userEvent.type(amount, "250000");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await userEvent.click(
      region.getByRole("button", { name: "Change contribution from Nov/2026" }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Remove change",
      }),
    );
    await waitFor(() => {
      expect(region.queryByText("from Nov/2026")).toBeNull();
    });
    await userEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({ changes: [changes[0]] });
  });

  it("PX9: a new change has no removal and the only change cannot be removed", async () => {
    const region = await block([{ month: "2026-11-01", amount: 100000 }]);
    const dialog = await openAdd();

    expect(dialog.queryByRole("button", { name: "Remove change" })).toBeNull();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await userEvent.click(
      region.getByRole("button", {
        name: "Change contribution since Nov/2026",
      }),
    );

    expect(
      within(await screen.findByRole("dialog")).queryByRole("button", {
        name: "Remove change",
      }),
    ).toBeNull();
  });

  it("PJ2, PJ4: a taken month and a past month show an error and Save does nothing", async () => {
    const region = await block();
    const dialog = await openAdd();
    const previous = dialog.getByRole("button", {
      name: catalogEn["month.previous"],
    });
    const save = dialog.getByRole("button", { name: "Save" });

    await userEvent.click(previous);

    expect(
      dialog.getByText(
        catalogEn["portfolio.projection.contributions.error.taken"],
      ),
    ).toBeInTheDocument();
    await userEvent.click(save);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.click(previous);
    await userEvent.click(previous);

    expect(
      dialog.getByText(
        catalogEn["portfolio.projection.contributions.error.past"],
      ),
    ).toBeInTheDocument();
    await userEvent.click(save);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(region.queryByText("from Sep/2026")).toBeNull();
  });
});
