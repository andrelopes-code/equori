import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { checkingID, money } from "@/testing/account-api";
import { json, problem } from "@/testing/fake-api";
import {
  occurrence,
  planningApi as api,
  rent,
  rentID,
  salaryID,
  schedules,
  streamingID,
  streamingSchedule,
} from "@/testing/planning-api";
import { chooseAccount } from "@/testing/account-choice";
import { optionalName } from "@/testing/optional-name";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

async function pick(label: string, text: string) {
  const input = screen.getByRole("combobox", { name: label });
  await userEvent.click(input);
  await userEvent.type(input, text);
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
  await userEvent.keyboard("{ArrowDown}{Enter}");
}

describe("Schedules tab", () => {
  it("states the share of the yearly income the yearly bills and subscriptions take", async () => {
    await renderApp("/planning?tab=schedules", { fetch: api() });

    const mark = await screen.findByText("42.80%");

    expect(mark.tagName).toBe("MARK");
    expect(mark.closest("[data-ui='highlight']")).toHaveTextContent(
      words("schedules.recurringShare", { percent: "42.80%", currency: "BRL" }),
    );
  });

  it("states what each schedule moves in a year, and leaves a transfer out", async () => {
    await renderApp("/planning?tab=schedules", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["schedules.caption"],
    });
    expect(
      await within(table).findByRole("columnheader", {
        name: catalogEn["schedules.yearly"],
      }),
    ).toBeInTheDocument();
    const rentRow = await within(table).findByRole("row", { name: /^Rent/ });
    expect(within(rentRow).getByText("R$25,200.00")).toBeInTheDocument();
    const salaryRow = within(table).getByRole("row", { name: /^Salary/ });
    expect(within(salaryRow).getByText("R$60,000.00")).toBeInTheDocument();
    const streamingRow = within(table).getByRole("row", {
      name: /^Streaming/,
    });
    expect(within(streamingRow).getByText("R$478.80")).toBeInTheDocument();
  });

  it("lists the schedules by kind with their current terms, next occurrence and end", async () => {
    await renderApp("/planning?tab=schedules", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["schedules.caption"],
    });
    const rentRow = await within(table).findByRole("row", { name: /^Rent/ });
    expect(within(rentRow).getByText("Nubank")).toBeInTheDocument();
    expect(within(rentRow).getByText("Mercado")).toBeInTheDocument();
    expect(within(rentRow).getByText("R$2,100.00")).toBeInTheDocument();
    expect(
      within(rentRow).getByText(
        "Every month, on day 5, moved to the next business day, from 01/05/2026",
      ),
    ).toBeInTheDocument();
    const salaryRow = within(table).getByRole("row", { name: /^Salary/ });
    expect(within(salaryRow).getByText("10/20/2026")).toBeInTheDocument();
    const streamingRow = within(table).getByRole("row", {
      name: /^Streaming/,
    });
    expect(within(streamingRow).getByText("R$39.90")).toBeInTheDocument();
    expect(within(streamingRow).getByText("06/01/2027")).toBeInTheDocument();
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent),
    ).toEqual([
      expect.stringContaining(catalogEn["scheduled.kind.bill"]),
      "Rent",
      expect.stringContaining(catalogEn["scheduled.kind.income"]),
      "Salary",
      expect.stringContaining(catalogEn["scheduled.kind.subscription"]),
      "Streaming",
    ]);
  });
});

describe("Schedules tab with ended schedules", () => {
  const gym = {
    ...streamingSchedule,
    id: "e1000000-0000-4000-8000-000000000009",
    description: "Gym",
    ends_on: "2026-09-01",
  };

  it("lists the schedules that ended apart from the active ones", async () => {
    await renderApp("/planning?tab=schedules", {
      fetch: api({
        "GET /api/v1/schedules": () =>
          json(200, { items: [gym, ...schedules] }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["schedules.caption"],
    });
    await within(table).findByRole("row", { name: /^Rent/ });

    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent),
    ).toEqual([
      expect.stringContaining(catalogEn["scheduled.kind.bill"]),
      "Rent",
      expect.stringContaining(catalogEn["scheduled.kind.income"]),
      "Salary",
      expect.stringContaining(catalogEn["scheduled.kind.subscription"]),
      "Streaming",
      expect.stringContaining(catalogEn["schedules.ended"]),
      expect.stringContaining("Gym"),
    ]);
  });

  it("names the kind of an ended schedule, which its group no longer says", async () => {
    await renderApp("/planning?tab=schedules", {
      fetch: api({
        "GET /api/v1/schedules": () => json(200, { items: [gym] }),
      }),
    });
    const row = await screen.findByRole("row", { name: /^Gym/ });

    expect(
      within(row).getByText(catalogEn["scheduled.kind.subscription"]),
    ).toBeInTheDocument();
  });

  it("draws an ended schedule muted and an active one in the table ink", async () => {
    await renderApp("/planning?tab=schedules", {
      fetch: api({
        "GET /api/v1/schedules": () =>
          json(200, { items: [gym, ...schedules] }),
      }),
    });
    const ended = await screen.findByRole("row", { name: /^Gym/ });
    const active = screen.getByRole("row", { name: /^Rent/ });
    const mutedIn = (row: HTMLElement) =>
      row.querySelectorAll('[data-ui="typography"][data-tone="muted"]').length;

    const mutedInk = '[data-ui="typography"][data-tone="muted"]';

    expect(
      within(ended).getByRole("link", { name: "Gym" }).closest(mutedInk),
    ).not.toBeNull();
    expect(mutedIn(ended)).toBeGreaterThan(1);
    expect(mutedIn(active)).toBe(0);
  });

  it("orders the ended schedules by the latest end first", async () => {
    const older = {
      ...gym,
      id: `${gym.id.slice(0, -1)}8`,
      description: "Old",
      ends_on: "2026-03-01",
    };
    await renderApp("/planning?tab=schedules", {
      fetch: api({
        "GET /api/v1/schedules": () => json(200, { items: [older, gym] }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["schedules.caption"],
    });
    await within(table).findByRole("row", { name: /^Gym/ });

    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent),
    ).toEqual([
      expect.stringContaining(catalogEn["schedules.ended"]),
      expect.stringContaining("Gym"),
      expect.stringContaining("Old"),
    ]);
  });
});

describe("New schedule", () => {
  it("creates a schedule from the recurrence builder and states the rule in words", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp("/planning/schedules/new", {
      fetch: api({
        "POST /api/v1/schedules": async (req) => {
          sent.push(await req.json());
          return json(201, rent);
        },
      }),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["schedule.description"],
      }),
      "Rent",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: catalogEn["schedule.amount"] }),
      "210000",
    );
    await chooseAccount(catalogEn["schedule.account"], "Nubank");
    await pick(catalogEn["schedule.category"], "Mercado");
    await userEvent.click(
      screen.getByRole("combobox", {
        name: catalogEn["recurrence.adjustment"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("option", {
        name: catalogEn["recurrence.adjustment.following"],
      }),
    );
    expect(
      screen.getByText(
        "Every month, on day 17, moved to the next business day, from 10/17/2026",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.create"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          kind: "bill",
          account_id: checkingID,
          counterpart_id: rent.counterpart_id,
          description: "Rent",
          amount: money(210000),
          recurrence: {
            frequency: "monthly",
            interval: 1,
            day_of_month: 17,
            adjustment: "following",
            start: "2026-10-17",
          },
          match_tolerance_bp: 1000,
          grace_days: 3,
          match_window_days: 7,
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/planning/schedules/${rentID}`,
      );
    });
  });

  async function openForm(sent: unknown[]) {
    await renderApp("/planning/schedules/new", {
      fetch: api({
        "POST /api/v1/schedules": async (req) => {
          sent.push(await req.json());
          return json(201, rent);
        },
      }),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["schedule.description"],
      }),
      "Move",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: catalogEn["schedule.amount"] }),
      "1000",
    );
  }

  async function chooseKind(label: string) {
    await userEvent.click(
      screen.getByRole("combobox", { name: catalogEn["schedule.kind"] }),
    );
    await userEvent.click(await screen.findByRole("option", { name: label }));
  }

  it("clears the category when the kind turns into a transfer", async () => {
    const sent: unknown[] = [];
    await openForm(sent);
    await chooseAccount(catalogEn["schedule.account"], "Nubank");
    await pick(catalogEn["schedule.category"], "Mercado");
    await chooseKind(catalogEn["scheduled.kind.transfer"]);
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.create"] }),
    );

    expect(
      await screen.findByText(catalogEn["schedule.required.counterpart"]),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("keeps the category when the kind changes between category kinds", async () => {
    const sent: unknown[] = [];
    await openForm(sent);
    await chooseAccount(catalogEn["schedule.account"], "Nubank");
    await pick(catalogEn["schedule.category"], "Mercado");
    await chooseKind(catalogEn["scheduled.kind.subscription"]);
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.create"] }),
    );

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toMatchObject({
      kind: "subscription",
      account_id: checkingID,
      counterpart_id: rent.counterpart_id,
    });
  });

  it("leaves the destination of a transfer out of the source accounts", async () => {
    await openForm([]);
    await chooseKind(catalogEn["scheduled.kind.transfer"]);
    await chooseAccount(catalogEn["schedule.to"], "Reserva");
    await userEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(`^${catalogEn["schedule.account"]}`),
      }),
    );
    const sheet = await screen.findByRole("dialog", {
      name: catalogEn["schedule.account"],
    });

    expect(
      await within(sheet).findByRole("radio", { name: /^Nubank/ }),
    ).toBeInTheDocument();
    expect(
      within(sheet).queryByRole("radio", { name: /^Reserva/ }),
    ).not.toBeInTheDocument();
  });

  it("sends the tolerance and the grace days typed in the advanced section", async () => {
    const sent: unknown[] = [];
    await openForm(sent);
    await chooseAccount(catalogEn["schedule.account"], "Nubank");
    await pick(catalogEn["schedule.category"], "Mercado");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.advanced"] }),
    );
    const tolerance = screen.getByRole("spinbutton", {
      name: catalogEn["schedule.tolerance"],
    });
    await userEvent.clear(tolerance);
    await userEvent.type(tolerance, "5");
    const grace = screen.getByRole("spinbutton", {
      name: catalogEn["schedule.grace"],
    });
    await userEvent.clear(grace);
    await userEvent.type(grace, "7");
    await userEvent.tab();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.create"] }),
    );

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toMatchObject({ match_tolerance_bp: 500, grace_days: 7 });
  });
});

describe("New schedule from another", () => {
  function expectedRent(req: Request) {
    const query = new URL(req.url).searchParams;
    const items =
      query.get("schedule_id") === rentID && query.get("state") === "expected"
        ? [occurrence("4", rentID, "2026-11-05", 210000, "expected")]
        : [];
    return json(200, { items });
  }

  it("fills every field but the account and starts on the next expected date", async () => {
    const sent: unknown[] = [];
    await renderApp(`/planning/schedules/new?from=${rentID}`, {
      fetch: api({
        "GET /api/v1/occurrences": expectedRent,
        "POST /api/v1/schedules": async (req) => {
          sent.push(await req.json());
          return json(201, rent);
        },
      }),
    });
    const description = await screen.findByRole("textbox", {
      name: catalogEn["schedule.description"],
    });
    await waitFor(() => {
      expect(description).toHaveValue("Rent");
    });
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.create"] }),
    );

    expect(
      await screen.findByText(catalogEn["schedule.required.account"]),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);

    await chooseAccount(catalogEn["schedule.account"], "Nubank");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.create"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          kind: "bill",
          account_id: checkingID,
          counterpart_id: rent.counterpart_id,
          description: "Rent",
          amount: money(210000),
          recurrence: {
            frequency: "monthly",
            interval: 1,
            adjustment: "following",
            day_of_month: 5,
            start: "2026-11-05",
          },
          match_tolerance_bp: 1000,
          grace_days: 3,
          match_window_days: 7,
        },
      ]);
    });
  });
});

describe("New schedule from a schedule without a next occurrence", () => {
  it("starts on today when the source has no expected occurrence", async () => {
    const sent: { recurrence: { start: string } }[] = [];
    await renderApp(`/planning/schedules/new?from=${rentID}`, {
      fetch: api({
        "GET /api/v1/occurrences": () => json(200, { items: [] }),
        "POST /api/v1/schedules": async (req) => {
          sent.push((await req.json()) as (typeof sent)[number]);
          return json(201, rent);
        },
      }),
    });
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", {
          name: catalogEn["schedule.description"],
        }),
      ).toHaveValue("Rent");
    });
    await chooseAccount(catalogEn["schedule.account"], "Nubank");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.create"] }),
    );

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.recurrence.start).toBe("2026-10-17");
  });

  it("opens the empty form when the source does not exist", async () => {
    await renderApp(`/planning/schedules/new?from=${rentID}`, {
      fetch: api({
        [`GET /api/v1/schedules/${rentID}`]: () => problem(404, "not_found"),
      }),
    });

    expect(
      await screen.findByRole("textbox", {
        name: catalogEn["schedule.description"],
      }),
    ).toHaveValue("");
  });
});

describe("Move a schedule to another account", () => {
  const movedID = salaryID;
  const nextRent = occurrence("4", rentID, "2026-11-05", 210000, "expected");

  function moveApi(calls: string[], endAnswer: () => Response) {
    return api({
      "GET /api/v1/occurrences": () => json(200, { items: [nextRent] }),
      "POST /api/v1/schedules": () => {
        calls.push("create");
        return json(201, { ...rent, id: movedID });
      },
      [`POST /api/v1/schedules/${rentID}/end`]: async (req) => {
        calls.push(`end ${JSON.stringify(await req.json())}`);
        return endAnswer();
      },
    });
  }

  async function saveWithAccount() {
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", {
          name: catalogEn["schedule.description"],
        }),
      ).toHaveValue("Rent");
    });
    await chooseAccount(catalogEn["schedule.account"], "Nubank");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.create"] }),
    );
  }

  it("opens the filled form from the schedule page", async () => {
    const { router } = await renderApp(`/planning/schedules/${rentID}`, {
      fetch: api(),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["schedule.moveToAccount"],
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/planning/schedules/new");
    });
    expect(router.state.location.search).toEqual({ from: rentID });
  });

  it("offers no move, pause, end or change of terms for a schedule that has ended", async () => {
    await renderApp(`/planning/schedules/${rentID}`, {
      fetch: api({
        [`GET /api/v1/schedules/${rentID}`]: () =>
          json(200, { ...rent, ends_on: "2026-10-01" }),
      }),
    });
    await screen.findByRole("button", {
      name: catalogEn["schedule.matching.edit"],
    });

    expect(
      screen.queryByRole("button", {
        name: catalogEn["schedule.moveToAccount"],
      }),
    ).not.toBeInTheDocument();
    for (const key of [
      "schedule.pause",
      "schedule.end",
      "schedule.changeTerms",
    ] as const) {
      expect(
        screen.queryByRole("button", { name: catalogEn[key] }),
      ).not.toBeInTheDocument();
    }
  });

  it("offers the move to a schedule that ends later", async () => {
    await renderApp(`/planning/schedules/${streamingID}`, { fetch: api() });

    expect(
      await screen.findByRole("button", {
        name: catalogEn["schedule.moveToAccount"],
      }),
    ).toBeInTheDocument();
  });

  it("creates the new schedule, then ends the source on its start date", async () => {
    const calls: string[] = [];
    const { router } = await renderApp(
      `/planning/schedules/new?from=${rentID}`,
      { fetch: moveApi(calls, () => json(200, rent)) },
    );
    await saveWithAccount();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/planning/schedules/${movedID}`,
      );
    });
    expect(calls).toEqual(["create", 'end {"from":"2026-11-05"}']);
  });

  it("keeps the form and retries only the end when the end fails", async () => {
    const calls: string[] = [];
    let refuse = true;
    const { router } = await renderApp(
      `/planning/schedules/new?from=${rentID}`,
      {
        fetch: moveApi(calls, () => {
          if (!refuse) return json(200, rent);
          refuse = false;
          return problem(409, "schedule_ended");
        }),
      },
    );
    await saveWithAccount();

    expect(
      await screen.findByText((text) =>
        text.startsWith(catalogEn["schedule.moveEndFailed"]),
      ),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/planning/schedules/new");

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.create"] }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/planning/schedules/${movedID}`,
      );
    });
    expect(calls).toEqual([
      "create",
      'end {"from":"2026-11-05"}',
      'end {"from":"2026-11-05"}',
    ]);
  });
});

describe("Schedule form calendar", () => {
  async function submitWith(pickedCalendar: string | null) {
    const sent: Record<string, unknown>[] = [];
    await renderApp("/planning/schedules/new", {
      fetch: api({
        "POST /api/v1/schedules": async (req) => {
          sent.push((await req.json()) as Record<string, unknown>);
          return json(201, rent);
        },
      }),
    });
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogEn["schedule.description"],
      }),
      "Rent",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: catalogEn["schedule.amount"] }),
      "210000",
    );
    await chooseAccount(catalogEn["schedule.account"], "Nubank");
    await pick(catalogEn["schedule.category"], "Mercado");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.advanced"] }),
    );
    const select = screen.getByRole("combobox", {
      name: catalogEn["schedule.calendar"],
    });
    await waitFor(() => {
      expect(select).toHaveTextContent("Brazilian banking days (your region)");
    });
    if (pickedCalendar !== null) {
      await userEvent.click(select);
      await userEvent.click(
        await screen.findByRole("option", { name: pickedCalendar }),
      );
    }
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["schedule.create"] }),
    );
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    return sent[0];
  }

  it("opens on the region's calendar and omits it from the request", async () => {
    expect(await submitWith(null)).not.toHaveProperty("calendar");
  });

  it("sends a calendar other than the region's", async () => {
    expect(await submitWith(catalogEn["calendar.weekend"])).toHaveProperty(
      "calendar",
      "weekend",
    );
  });
});

describe("Schedule calendar links", () => {
  it("links the schedule's calendar to its holidays in the settings", async () => {
    await renderApp(`/planning/schedules/${rentID}`, { fetch: api() });
    const link = await screen.findByRole("link", {
      name: catalogEn["calendar.br_banking"],
    });
    expect(link).toHaveAttribute(
      "href",
      "/settings?section=calendars&calendar=br_banking",
    );
  });

  it("links the form's chosen calendar to its holidays in the settings", async () => {
    await renderApp("/planning/schedules/new", { fetch: api() });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["schedule.advanced"],
      }),
    );
    const link = await screen.findByRole("link", {
      name: catalogEn["calendar.open"],
    });
    expect(link).toHaveAttribute(
      "href",
      "/settings?section=calendars&calendar=br_banking",
    );
  });
});

describe("Schedule page", () => {
  it("lists the terms versions, the pauses and the end", async () => {
    await renderApp(`/planning/schedules/${streamingID}`, { fetch: api() });
    const terms = await screen.findByRole("table", {
      name: catalogEn["schedule.terms"],
    });
    expect(
      within(terms)
        .getAllByRole("row")
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole("cell")
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      ["R$39.90", "Every month, on day 12, from 01/12/2026"],
      ["R$44.90", "Every month, on day 12, from 01/12/2026"],
    ]);
    const pauses = screen.getByRole("table", {
      name: catalogEn["schedule.pauses"],
    });
    expect(within(pauses).getByText("02/01/2027")).toBeInTheDocument();
    expect(within(pauses).getByText("03/31/2027")).toBeInTheDocument();
  });

  it("labels the change of terms with words alone on a desktop", async () => {
    await renderApp(`/planning/schedules/${rentID}`, { fetch: api() });
    const button = await screen.findByRole("button", {
      name: catalogEn["schedule.changeTerms"],
    });
    expect(button.querySelector('[data-ui="icon"]')).toBeNull();
  });

  it("changes the amount from a date after the latest version", async () => {
    const sent: unknown[] = [];
    await renderApp(`/planning/schedules/${rentID}`, {
      fetch: api({
        [`POST /api/v1/schedules/${rentID}/terms`]: async (req) => {
          sent.push(await req.json());
          return json(201, rent);
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["schedule.changeTerms"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: optionalName(catalogEn["schedule.amount"]),
      }),
      "230000",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["schedule.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { effective_from: "2026-10-17", amount: money(230000) },
      ]);
    });
  });

  describe("amount drift", () => {
    const nextRent = occurrence("5", rentID, "2026-11-05", 210000, "expected");
    const received = [
      ["6", "2026-09-05", 190000],
      ["7", "2026-08-05", 191000],
      ["8", "2026-07-05", 189000],
    ].map(([id, date, amount]) => ({
      ...occurrence(String(id), rentID, String(date), 210000, "realized"),
      actual_amount: money(Number(amount)),
    }));

    it("suggests the median of the last 3 amounts and prefills the terms dialog", async () => {
      const sent: unknown[] = [];
      await renderApp(`/planning/schedules/${rentID}`, {
        fetch: api({
          "GET /api/v1/occurrences": () =>
            json(200, { items: [...received, nextRent] }),
          [`POST /api/v1/schedules/${rentID}/terms`]: async (req) => {
            sent.push(await req.json());
            return json(201, rent);
          },
        }),
      });
      expect(
        await screen.findByText(
          words("schedule.drift.title", { amount: "R$1,900.00" }),
        ),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", {
          name: catalogEn["schedule.drift.action"],
        }),
      );
      const dialog = await screen.findByRole("dialog");
      await userEvent.click(
        within(dialog).getByRole("button", {
          name: catalogEn["schedule.save"],
        }),
      );

      await waitFor(() => {
        expect(sent).toEqual([
          { effective_from: "2026-11-05", amount: money(190000) },
        ]);
      });
    });

    it("stays silent when the received amounts match the expected one", async () => {
      await renderApp(`/planning/schedules/${rentID}`, { fetch: api() });
      await screen.findByRole("table", { name: catalogEn["schedule.terms"] });

      expect(
        screen.queryByRole("button", {
          name: catalogEn["schedule.drift.action"],
        }),
      ).toBeNull();
    });
  });

  it("changes the matching settings and states that they apply from now on", async () => {
    const sent: unknown[] = [];
    await renderApp(`/planning/schedules/${rentID}`, {
      fetch: api({
        [`PATCH /api/v1/schedules/${rentID}`]: async (req) => {
          sent.push(await req.json());
          return json(200, rent);
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["schedule.matching.edit"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const tolerance = within(dialog).getByRole("spinbutton", {
      name: catalogEn["schedule.tolerance"],
    });
    expect(tolerance).toHaveValue("10");
    expect(
      within(dialog).getByRole("spinbutton", {
        name: catalogEn["schedule.window"],
      }),
    ).toHaveValue("7");
    expect(
      within(dialog).getByRole("spinbutton", {
        name: catalogEn["schedule.grace"],
      }),
    ).toHaveValue("3");
    expect(
      within(dialog).getByText(catalogEn["schedule.matching.appliesLater"]),
    ).toBeInTheDocument();

    await userEvent.clear(tolerance);
    await userEvent.type(tolerance, "0.5");
    await userEvent.tab();
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["schedule.save"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        { match_tolerance_bp: 50, grace_days: 3, match_window_days: 7 },
      ]);
    });
  });

  it("renames a schedule that has ended and sends only the description", async () => {
    const sent: unknown[] = [];
    await renderApp(`/planning/schedules/${rentID}`, {
      fetch: api({
        [`GET /api/v1/schedules/${rentID}`]: () =>
          json(200, { ...rent, ends_on: "2026-10-01" }),
        [`PATCH /api/v1/schedules/${rentID}`]: async (req) => {
          sent.push(await req.json());
          return json(200, rent);
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["schedule.rename"] }),
    );
    const dialog = await screen.findByRole("dialog");
    const description = within(dialog).getByRole("textbox", {
      name: catalogEn["schedule.description"],
    });
    expect(description).toHaveValue(rent.description);

    await userEvent.clear(description);
    await userEvent.type(description, "Uber Moto Flex");
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["schedule.save"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([{ description: "Uber Moto Flex" }]);
    });
  });

  it("starts the schedule earlier from the day before its current start", async () => {
    const sent: unknown[] = [];
    await renderApp(`/planning/schedules/${rentID}`, {
      fetch: api({
        [`PATCH /api/v1/schedules/${rentID}`]: async (req) => {
          sent.push(await req.json());
          return json(200, rent);
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["schedule.startEarlier"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(catalogEn["schedule.startEarlier.hint"]),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["schedule.save"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([{ starts_on: "2026-01-04" }]);
    });
  });

  it("adds a pause", async () => {
    const sent: unknown[] = [];
    await renderApp(`/planning/schedules/${rentID}`, {
      fetch: api({
        [`POST /api/v1/schedules/${rentID}/pauses`]: async (req) => {
          sent.push(await req.json());
          return json(201, rent);
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["schedule.pause"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["schedule.pause"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ from: "2026-10-17", to: "2026-11-16" }]);
    });
  });

  it("ends the schedule after stating what happens to its occurrences", async () => {
    const sent: unknown[] = [];
    await renderApp(`/planning/schedules/${rentID}`, {
      fetch: api({
        [`POST /api/v1/schedules/${rentID}/end`]: async (req) => {
          sent.push(await req.json());
          return json(200, { ...rent, ends_on: "2026-10-17" });
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["schedule.end"] }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        words("schedule.endHint", { date: "10/17/2026" }),
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["schedule.end"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ from: "2026-10-17" }]);
    });
  });

  it("shows the Problem of a refused end", async () => {
    await renderApp(`/planning/schedules/${rentID}`, {
      fetch: api({
        [`POST /api/v1/schedules/${rentID}/end`]: () =>
          problem(409, "schedule_ended"),
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["schedule.end"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["schedule.end"] }),
    );
    expect(
      await within(dialog).findByText(catalogEn["problem.schedule_ended"]),
    ).toBeInTheDocument();
  });
});
