import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { formatDayHeader } from "@/i18n/format";
import { accountRoutes, checkingID, money } from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

function schedule(id: string, kind: string, description: string) {
  return {
    id,
    kind,
    calendar: "br_banking",
    account_id: checkingID,
    counterpart_id: "a1000000-0000-4000-8000-00000000000c",
    description,
    match_tolerance_bp: 1000,
    grace_days: 3,
    terms: [
      {
        effective_from: "2026-01-01",
        amount: money(210000),
        recurrence: { frequency: "monthly", interval: 1, start: "2026-01-05" },
      },
    ],
    pauses: [],
  };
}

const rentID = "e1000000-0000-4000-8000-000000000001";
const salaryID = "e1000000-0000-4000-8000-000000000002";
const streamingID = "e1000000-0000-4000-8000-000000000003";
const schedules = [
  schedule(rentID, "bill", "Rent"),
  schedule(salaryID, "income", "Salary"),
  schedule(streamingID, "subscription", "Streaming"),
];

function occurrence(
  id: string,
  scheduleID: string,
  date: string,
  amount: number,
  state: string,
) {
  return {
    id: `f1000000-0000-4000-8000-00000000000${id}`,
    schedule_id: scheduleID,
    sequence: 1,
    expected_on: date,
    expected_amount: money(amount),
    state,
  };
}

const rentSeptember = occurrence("1", rentID, "2026-09-05", 210000, "overdue");
const rentOctober = occurrence("2", rentID, "2026-10-05", 210000, "overdue");
const streaming = occurrence("3", streamingID, "2026-10-12", 3990, "realized");
const salary = occurrence("4", salaryID, "2026-10-20", 500000, "expected");

function transaction(id: string, date: string, amount: number) {
  return {
    id,
    date,
    description: id,
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: [
      {
        id: `${id}-1`,
        account_id: checkingID,
        amount: money(amount),
        weight: money(amount),
        status: "cleared",
      },
    ],
  };
}

const exactID = "a9000000-0000-4000-8000-000000000001";
const farID = "a9000000-0000-4000-8000-000000000002";

function api(overrides: Parameters<typeof accountRoutes>[0] = {}) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/schedules": () => json(200, { items: schedules }),
      ...Object.fromEntries(
        schedules.map((s) => [
          `GET /api/v1/schedules/${s.id}`,
          () => json(200, s),
        ]),
      ),
      "GET /api/v1/occurrences": (req) =>
        new URL(req.url).searchParams.get("state") === "overdue"
          ? json(200, { items: [rentSeptember, rentOctober] })
          : json(200, { items: [rentOctober, streaming, salary] }),
      "GET /api/v1/transactions": () =>
        json(200, {
          items: [
            transaction(farID, "2026-10-04", -150000),
            transaction(exactID, "2026-10-06", -210000),
          ],
        }),
      ...overrides,
    }),
  );
}

async function openAction(row: string, index: number, action: string) {
  const user = userEvent.setup();
  const buttons = await screen.findAllByRole("button", {
    name: catalogEn["occurrence.actions"].replace("{name}", row),
  });
  const button = buttons[index];
  if (button === undefined) throw new Error(`no actions for ${row}`);
  await user.click(button);
  await user.click(await screen.findByRole("menuitem", { name: action }));
  return { user, dialog: await screen.findByRole("dialog") };
}

describe("PlanningPage agenda", () => {
  it("lists the overdue occurrences first in their own group, then the month by day", async () => {
    await renderApp("/planning", { fetch: api() });
    await screen.findByRole("rowheader", { name: "Salary" });
    const headers = screen
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent);
    const day = (iso: string) =>
      formatDayHeader(iso, "2026-10-17", "en", {
        today: catalogEn["day.today"],
        yesterday: catalogEn["day.yesterday"],
      });
    expect(headers).toEqual([
      expect.stringContaining(catalogEn["agenda.overdue"]),
      "Rent",
      "Rent",
      expect.stringContaining(day("2026-10-12")),
      "Streaming",
      expect.stringContaining(day("2026-10-20")),
      "Salary",
    ]);
  });

  it("totals the month's expected inflow and outflow", async () => {
    await renderApp("/planning", { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["agenda.figures"],
    });
    await waitFor(() => {
      expect(within(figures).getByText("R$5,000.00")).toBeInTheDocument();
    });
    expect(within(figures).getByText("R$2,139.90")).toBeInTheDocument();
  });

  it("filters the agenda by kind", async () => {
    await renderApp("/planning", { fetch: api() });
    await screen.findByRole("rowheader", { name: "Salary" });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("combobox", { name: catalogEn["agenda.kind"] }),
    );
    await user.click(
      await screen.findByRole("option", {
        name: catalogEn["scheduled.kind.income"],
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("rowheader", { name: "Rent" })).toBeNull();
    });
    expect(
      screen.getByRole("rowheader", { name: "Salary" }),
    ).toBeInTheDocument();
  });

  it("realizes an occurrence with the transaction closest to its expected amount", async () => {
    const sent: unknown[] = [];
    await renderApp("/planning", {
      fetch: api({
        [`POST /api/v1/occurrences/${rentOctober.id}/realize`]: async (req) => {
          sent.push(await req.json());
          return json(200, { ...rentOctober, state: "realized" });
        },
      }),
    });
    const { user, dialog } = await openAction(
      "Rent",
      1,
      catalogEn["occurrence.realize"],
    );
    const rows = await within(dialog).findAllByRole("rowheader");
    expect(rows.map((r) => r.textContent)).toEqual([
      "10/06/2026",
      "10/04/2026",
    ]);
    expect(
      within(dialog).getAllByText(catalogEn["occurrence.outsideTolerance"]),
    ).toHaveLength(1);
    const first = rows[0]?.closest("tr");
    if (!first) throw new Error("no candidate row");
    await user.click(within(first).getByRole("checkbox"));
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["occurrence.realize"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ transaction_id: exactID }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("shows the Problem the server returns for a realize", async () => {
    await renderApp("/planning", {
      fetch: api({
        [`POST /api/v1/occurrences/${rentOctober.id}/realize`]: () =>
          problem(409, "transaction_in_use"),
      }),
    });
    const { user, dialog } = await openAction(
      "Rent",
      1,
      catalogEn["occurrence.realize"],
    );
    const rows = await within(dialog).findAllByRole("rowheader");
    const first = rows[0]?.closest("tr");
    if (!first) throw new Error("no candidate row");
    await user.click(within(first).getByRole("checkbox"));
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["occurrence.realize"],
      }),
    );
    expect(
      await within(dialog).findByText(catalogEn["problem.transaction_in_use"]),
    ).toBeInTheDocument();
  });

  it("skips an occurrence with a reason", async () => {
    const sent: unknown[] = [];
    await renderApp("/planning", {
      fetch: api({
        [`POST /api/v1/occurrences/${salary.id}/skip`]: async (req) => {
          sent.push(await req.json());
          return json(200, { ...salary, state: "skipped" });
        },
      }),
    });
    const { user, dialog } = await openAction(
      "Salary",
      0,
      catalogEn["occurrence.skip"],
    );
    await user.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["occurrence.reason"],
      }),
      "Paid in cash",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["occurrence.skip"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ reason: "Paid in cash" }]);
    });
  });

  it("moves an occurrence to another date", async () => {
    const sent: unknown[] = [];
    await renderApp("/planning", {
      fetch: api({
        [`POST /api/v1/occurrences/${salary.id}/move`]: async (req) => {
          sent.push(await req.json());
          return json(200, { ...salary, expected_on: "2026-10-17" });
        },
      }),
    });
    const { user, dialog } = await openAction(
      "Salary",
      0,
      catalogEn["occurrence.move"],
    );
    await user.click(
      within(dialog).getByRole("button", { name: catalogEn["day.today"] }),
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["occurrence.move"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ date: "2026-10-17" }]);
    });
  });

  it("unrealizes a realized occurrence and reads the agenda again", async () => {
    const fetch = api({
      [`POST /api/v1/occurrences/${streaming.id}/unrealize`]: () =>
        json(200, { ...streaming, state: "expected" }),
    });
    await renderApp("/planning", { fetch });
    const { user, dialog } = await openAction(
      "Streaming",
      0,
      catalogEn["occurrence.unrealize"],
    );
    expect(
      within(dialog).queryByRole("button", {
        name: catalogEn["occurrence.realize"],
      }),
    ).toBeNull();
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["occurrence.unrealize"],
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
