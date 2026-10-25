import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { formatDayHeader } from "@/i18n/format";
import { json, problem } from "@/testing/fake-api";
import {
  exactID,
  planningApi as api,
  rentOctober,
  salary,
  streaming,
} from "@/testing/planning-api";
import { renderApp } from "@/testing/render-app";

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
  it("steps the agenda's month from the page header", async () => {
    const { container, router } = await renderApp("/planning", {
      fetch: api(),
    });
    await screen.findByRole("rowheader", { name: "Salary" });
    const header = container.querySelector('[data-ui="page-header"]');
    if (!(header instanceof HTMLElement)) throw new Error("no page header");
    const month = within(header).getByRole("group", {
      name: catalogEn["agenda.month"],
    });
    await userEvent.click(
      within(month).getByRole("button", { name: catalogEn["month.next"] }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ month: "2026-11" });
    });
  });

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

  it("says where a moved occurrence was expected before", async () => {
    await renderApp("/planning", {
      fetch: api({
        "GET /api/v1/occurrences": (req) =>
          new URL(req.url).searchParams.get("state") === "overdue"
            ? json(200, { items: [] })
            : json(200, {
                items: [{ ...salary, moved_from: "2026-10-18" }],
              }),
      }),
    });
    const row = await screen.findByRole("row", { name: /^Salary/ });
    expect(
      within(row).getByText(
        catalogEn["agenda.movedFrom"].replace("{date}", "10/18/2026"),
      ),
    ).toBeInTheDocument();
  });

  it("totals a day with one figure per currency, with a base currency of EUR", async () => {
    await renderApp("/planning", {
      fetch: api({
        "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
        "GET /api/v1/occurrences": (req) =>
          new URL(req.url).searchParams.get("state") === "overdue"
            ? json(200, { items: [] })
            : json(200, {
                items: [
                  {
                    ...rentOctober,
                    state: "expected",
                    expected_amount: { amount: 5000, currency: "EUR" },
                  },
                  {
                    ...rentOctober,
                    id: "f1000000-0000-4000-8000-0000000000aa",
                    state: "expected",
                    expected_amount: { amount: 1000, currency: "USD" },
                  },
                ],
              }),
      }),
    });
    await screen.findAllByRole("rowheader", { name: /·/ });
    const headers = screen
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent);
    expect(headers).toEqual(["Mon, Oct 5−€5,000 · −$10.00", "Rent", "Rent"]);
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
