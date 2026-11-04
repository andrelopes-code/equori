import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import {
  planningApi as api,
  streamingID,
  streamingSchedule,
} from "@/testing/planning-api";
import { renderApp } from "@/testing/render-app";

describe("Subscriptions tab", () => {
  it("costs each subscription a month and a year and lists its price changes (S29)", async () => {
    await renderApp("/planning?tab=subscriptions", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["subscriptions.caption"],
    });
    const row = await within(table).findByRole("row", { name: /^Streaming/ });
    const cells = within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(cells.slice(0, 4)).toEqual([
      "Nubank",
      "R$39.90",
      "R$39.90",
      "R$478.80",
    ]);
    expect(cells[4]).toContain("R$39.90");
    expect(cells[4]).toContain("R$44.90");
    expect(cells[4]).toContain("01/01/2027");
    expect(cells[5]).toBe("06/01/2027");
    const summary = within(table).getAllByRole("row").at(-1);
    if (summary === undefined) throw new Error("no summary row");
    expect(within(summary).getAllByText("R$39.90")).toHaveLength(1);
    expect(within(summary).getByText("R$478.80")).toBeInTheDocument();
  });

  it("pauses a subscription from its row", async () => {
    const sent: unknown[] = [];
    await renderApp("/planning?tab=subscriptions", {
      fetch: api({
        [`POST /api/v1/schedules/${streamingID}/pauses`]: async (req) => {
          sent.push(await req.json());
          return json(201, streamingSchedule);
        },
      }),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["subscriptions.actions"].replace("{name}", "Streaming"),
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["schedule.pause"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: catalogEn["schedule.pause"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ from: "2026-10-17", to: "2026-11-16" }]);
    });
  });

  it("moves a subscription to another account from its row", async () => {
    const { router } = await renderApp("/planning?tab=subscriptions", {
      fetch: api(),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["subscriptions.actions"].replace("{name}", "Streaming"),
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["schedule.moveToAccount"],
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/planning/schedules/new");
    });
    expect(router.state.location.search).toEqual({ from: streamingID });
  });
});

describe("Subscriptions tab with an ended subscription", () => {
  const gym = {
    ...streamingSchedule,
    id: "e1000000-0000-4000-8000-000000000009",
    description: "Gym",
    ends_on: "2026-09-01",
    terms: streamingSchedule.terms.map((v) => ({
      ...v,
      amount: { ...v.amount, amount: 10000 },
    })),
  };

  async function renderTable() {
    await renderApp("/planning?tab=subscriptions", {
      fetch: api({
        "GET /api/v1/schedules": () =>
          json(200, { items: [gym, streamingSchedule] }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["subscriptions.caption"],
    });
    await within(table).findByRole("row", { name: /^Streaming/ });
    return table;
  }

  it("lists the ended subscription after the active ones, under its own heading", async () => {
    const table = await renderTable();

    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Streaming",
      catalogEn["schedules.ended"],
      "Gym",
      catalogEn["subscriptions.total"],
    ]);
  });

  it("leaves the ended subscription out of the totals", async () => {
    const table = await renderTable();
    const summary = within(table).getAllByRole("row").at(-1);
    if (summary === undefined) throw new Error("no summary row");

    expect(within(summary).getByText("R$39.90")).toBeInTheDocument();
    expect(within(summary).getByText("R$478.80")).toBeInTheDocument();
    expect(within(summary).queryByText("R$139.90")).not.toBeInTheDocument();
  });

  it("draws the ended subscription muted and offers it no actions", async () => {
    const table = await renderTable();
    const ended = within(table).getByRole("row", { name: /^Gym/ });
    const active = within(table).getByRole("row", { name: /^Streaming/ });
    const mutedInk = '[data-ui="typography"][data-tone="muted"]';

    expect(
      within(ended).getByRole("link", { name: "Gym" }).closest(mutedInk),
    ).not.toBeNull();
    expect(
      within(active).getByRole("link", { name: "Streaming" }).closest(mutedInk),
    ).toBeNull();
    expect(
      within(ended).queryByRole("button", {
        name: catalogEn["subscriptions.actions"].replace("{name}", "Gym"),
      }),
    ).not.toBeInTheDocument();
    expect(
      within(active).getByRole("button", {
        name: catalogEn["subscriptions.actions"].replace("{name}", "Streaming"),
      }),
    ).toBeInTheDocument();
  });
});
