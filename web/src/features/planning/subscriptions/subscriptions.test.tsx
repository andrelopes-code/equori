import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { bandValue } from "@/testing/band-value";
import {
  planningApi as api,
  streamingID,
  streamingSchedule,
} from "@/testing/planning-api";
import { renderApp } from "@/testing/render-app";

// docs/specs/2026-11-15-planning-tabs-design.md, section 6.
describe("Subscriptions tab", () => {
  it("costs each subscription a month and a year and lists its price changes (S29)", async () => {
    await renderApp("/planning?tab=subscriptions", { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["subscriptions.figures"],
    });
    await waitFor(() => {
      expect(within(figures).getAllByText(bandValue("R$39.90"))).toHaveLength(
        2,
      );
    });
    expect(
      within(figures).getByText(bandValue("R$478.80")),
    ).toBeInTheDocument();

    const ranking = screen.getByRole("table", {
      name: catalogEn["subscriptions.ranking"],
    });
    const row = within(ranking).getByRole("row", { name: /^1 Streaming/ });
    expect(within(row).getByText("R$39.90")).toBeInTheDocument();
    expect(
      within(row).getByText(
        words("subscriptions.perYearLine", { amount: "R$478.80" }),
      ),
    ).toBeInTheDocument();
    expect(within(row).getByText("100.00%")).toBeInTheDocument();

    const changes = screen.getByRole("table", {
      name: catalogEn["subscriptions.changes"],
    });
    const change = within(changes).getByRole("row", { name: /^Streaming/ });
    expect(
      within(change).getByText(
        words("subscriptions.change.rises", { date: "01/01/2027" }),
      ),
    ).toBeInTheDocument();
    expect(
      within(change).getByText(
        words("subscriptions.fromTo", {
          from: "R$39.90",
          to: "R$44.90",
          year: "+R$60.00",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("leaves a subscription in another currency out of the totals and says why", async () => {
    const usd = {
      ...streamingSchedule,
      id: "e1000000-0000-4000-8000-00000000000a",
      description: "Cloud",
      terms: streamingSchedule.terms.map((v) => ({
        ...v,
        amount: { amount: 2000, currency: "USD" },
      })),
    };
    await renderApp("/planning?tab=subscriptions", {
      fetch: api({
        "GET /api/v1/schedules": () =>
          json(200, { items: [streamingSchedule, usd] }),
      }),
    });
    const figures = await screen.findByRole("region", {
      name: catalogEn["subscriptions.figures"],
    });

    await waitFor(() => {
      expect(
        within(figures).getByText(
          words("subscriptions.leftOut", { amounts: "$20.00" }),
        ),
      ).toBeInTheDocument();
    });
    const row = screen.getByRole("row", { name: /^2 Cloud/ });
    expect(
      within(row).getByText(catalogEn["subscriptions.outOfTotal"]),
    ).toBeInTheDocument();
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

  async function renderTab() {
    await renderApp("/planning?tab=subscriptions", {
      fetch: api({
        "GET /api/v1/schedules": () =>
          json(200, { items: [gym, streamingSchedule] }),
      }),
    });
    await screen.findByRole("row", { name: /^1 Streaming/ });
  }

  async function openEnded() {
    await userEvent.click(
      screen.getByRole("button", {
        name: words("subscriptions.endedCount", { count: "1" }),
      }),
    );
    return screen.findByRole("table", { name: catalogEn["schedules.ended"] });
  }

  it("keeps the ended subscription in a closed list after the active ones", async () => {
    await renderTab();
    expect(screen.queryByRole("row", { name: /Gym/ })).not.toBeInTheDocument();

    const ended = await openEnded();

    expect(
      within(ended).getByRole("row", { name: /^Gym/ }),
    ).toBeInTheDocument();
  });

  it("leaves the ended subscription out of the totals and counts what it saves", async () => {
    await renderTab();
    const figures = screen.getByRole("region", {
      name: catalogEn["subscriptions.figures"],
    });

    await waitFor(() => {
      expect(
        within(figures).getByText(bandValue("R$478.80")),
      ).toBeInTheDocument();
    });
    expect(
      within(figures).getByText(bandValue("R$100.00")),
    ).toBeInTheDocument();
    expect(
      within(figures).queryByText(bandValue("R$139.90")),
    ).not.toBeInTheDocument();
  });

  it("draws the ended subscription muted and offers it no actions", async () => {
    await renderTab();
    const active = screen.getByRole("row", { name: /^1 Streaming/ });

    const ended = within(await openEnded()).getByRole("row", { name: /^Gym/ });

    expect(ended).toHaveAttribute("data-muted");
    expect(active).not.toHaveAttribute("data-muted");
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

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}
