import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { checkingID, money } from "@/testing/account-api";
import { json, problem } from "@/testing/fake-api";
import {
  planningApi as api,
  rent,
  rentID,
  streamingID,
} from "@/testing/planning-api";
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
    await userEvent.click(
      within(
        screen.getByRole("radiogroup", { name: catalogEn["schedule.account"] }),
      ).getByRole("radio", { name: /^Nubank/ }),
    );
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
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/planning/schedules/${rentID}`,
      );
    });
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
    await userEvent.click(
      within(
        screen.getByRole("radiogroup", { name: catalogEn["schedule.account"] }),
      ).getByRole("radio", { name: /^Nubank/ }),
    );
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
      "/settings?calendar=br_banking#calendars",
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
      "/settings?calendar=br_banking#calendars",
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
        name: catalogEn["schedule.amount"],
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
