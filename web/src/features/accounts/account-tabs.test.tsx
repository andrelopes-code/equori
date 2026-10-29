import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountRoutes,
  brokerageID,
  checkingID,
  connectionFixture,
  connectionID,
  externalCheckingID,
  money,
  reserveID,
  stockID,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Route = (req: Request) => Response | Promise<Response>;

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

function counts(over: Record<string, number> = {}) {
  return {
    received: 10,
    ignored: 0,
    matched: 6,
    created: 3,
    needs_review: 1,
    discarded: 0,
    updated: 0,
    withdrawn: 0,
    ...over,
  };
}

function batch(id: string, account: string, file: string) {
  return {
    id,
    account_id: account,
    source: "ofx",
    file_name: file,
    period_from: "2026-09-01",
    period_to: "2026-09-30",
    counts: counts(),
    balance: { status: "recorded", date: "2026-09-30", amount: money(500000) },
    started_at: "2026-10-01T12:00:00Z",
    completed_at: "2026-10-01T12:00:05Z",
  };
}

function api(overrides: Record<string, Route> = {}) {
  return fakeApi(accountRoutes(overrides));
}

describe("Imports tab", () => {
  it("lists only this account's imports and opens one", async () => {
    await renderApp(`/accounts/${checkingID}?tab=imports`, {
      fetch: api({
        "GET /api/v1/import-batches": () =>
          json(200, {
            items: [
              batch("b1", checkingID, "setembro.ofx"),
              batch("b2", reserveID, "reserva.ofx"),
            ],
          }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["imports.caption"],
    });
    expect(await within(table).findByText("setembro.ofx")).toBeInTheDocument();
    expect(within(table).queryByText("reserva.ofx")).not.toBeInTheDocument();
    expect(
      within(table).getByText(
        words("imports.count.needs_review", { count: "1" }),
      ),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("link", { name: "setembro.ofx" }),
    ).toHaveAttribute("href", `/accounts/${checkingID}/imports/b1`);
  });
});

describe("Scheduled tab", () => {
  it("lists the expected entries with the balance each leaves", async () => {
    const tos: (string | null)[] = [];
    await renderApp(`/accounts/${checkingID}?tab=scheduled`, {
      fetch: api({
        [`GET /api/v1/accounts/${checkingID}/projection`]: (req) => {
          tos.push(new URL(req.url).searchParams.get("to"));
          return json(200, {
            account_id: checkingID,
            from: "2026-10-17",
            to: "2027-01-15",
            opening: money(524055),
            closing: money(374055),
            points: [
              {
                date: "2026-11-05",
                occurrence_id: "o1",
                schedule_id: "s1",
                amount: money(-150000),
                balance: money(374055),
              },
            ],
          });
        },
        "GET /api/v1/schedules/s1": () =>
          json(200, {
            id: "s1",
            kind: "bill",
            account_id: checkingID,
            counterpart_id: "x",
            description: "Aluguel",
            match_tolerance_bp: 0,
            grace_days: 3,
            terms: [],
            pauses: [],
          }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["scheduled.caption"],
    });
    const row = await within(table).findByRole("row", { name: /Aluguel/ });
    expect(within(row).getByText("−R$1,500.00")).toBeInTheDocument();
    expect(within(row).getByText("R$3,740.55")).toBeInTheDocument();
    // The schedule's name and its kind share one line on a wide screen.
    expect(
      within(row).getByText("Aluguel").closest('[data-ui="inline"]'),
    ).toContainElement(within(row).getByText(catalogEn["scheduled.kind.bill"]));
    await waitFor(() => {
      expect(tos).toContain("2027-01-15");
    });
  });
  it("skips an expected entry from its row", async () => {
    const sent: unknown[] = [];
    await renderApp(`/accounts/${checkingID}?tab=scheduled`, {
      fetch: api({
        [`GET /api/v1/accounts/${checkingID}/projection`]: () =>
          json(200, {
            account_id: checkingID,
            from: "2026-10-17",
            to: "2027-01-15",
            opening: money(524055),
            closing: money(374055),
            points: [
              {
                date: "2026-11-05",
                occurrence_id: "o1",
                schedule_id: "s1",
                amount: money(-150000),
                balance: money(374055),
              },
            ],
          }),
        "GET /api/v1/schedules/s1": () =>
          json(200, {
            id: "s1",
            kind: "bill",
            account_id: checkingID,
            counterpart_id: "x",
            description: "Aluguel",
            match_tolerance_bp: 0,
            grace_days: 3,
            terms: [],
            pauses: [],
          }),
        "POST /api/v1/occurrences/o1/skip": async (req) => {
          sent.push(await req.json());
          return json(200, {});
        },
      }),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: words("occurrence.actions", { name: "Aluguel" }),
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["occurrence.skip"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["occurrence.skip"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{}]);
    });
  });
});

describe("Positions tab", () => {
  it("values the brokerage's securities and says when a price is missing", async () => {
    await renderApp(`/accounts/${brokerageID}?tab=positions`, {
      fetch: api({
        "GET /api/v1/positions": () =>
          json(200, {
            items: [
              {
                account_id: stockID,
                instrument: "PETR4",
                quantity: money(100, "PETR4"),
                cost_basis: money(300000),
                average_cost: "30.00",
                market_value: money(380000),
              },
              {
                account_id: "elsewhere",
                instrument: "VALE3",
                quantity: money(10, "VALE3"),
                cost_basis: money(60000),
              },
            ],
          }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["positions.caption"],
    });
    const row = await within(table).findByRole("row", { name: /PETR4/ });
    expect(within(row).getByText("R$3,800.00")).toBeInTheDocument();
    expect(within(row).getByText("+R$800.00")).toBeInTheDocument();
    expect(within(table).queryByText("VALE3")).not.toBeInTheDocument();
  });

  it("says a position has no price", async () => {
    await renderApp(`/accounts/${brokerageID}?tab=positions`, {
      fetch: api({
        "GET /api/v1/positions": () =>
          json(200, {
            items: [
              {
                account_id: stockID,
                instrument: "PETR4",
                quantity: money(100, "PETR4"),
                cost_basis: money(300000),
              },
            ],
          }),
      }),
    });
    expect(
      await screen.findByText(catalogEn["positions.noPrice"]),
    ).toBeInTheDocument();
  });
});

describe("Sync tab", () => {
  it("shows the link and syncs the connection now", async () => {
    const sent: string[] = [];
    await renderApp(`/accounts/${checkingID}?tab=sync`, {
      fetch: api({
        [`POST /api/v1/connections/${connectionID}/sync`]: () => {
          sent.push("sync");
          return json(200, {
            connection: connectionFixture,
            batches: [
              {
                ...batch("b9", checkingID, ""),
                counts: counts({ created: 4 }),
              },
            ],
          });
        },
      }),
    });
    expect(await screen.findByText("Conta Corrente")).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["sync.provider.UPDATED"]),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["sync.now"] }),
    );
    expect(
      await screen.findByText(
        words("sync.result", { created: "4", matched: "6" }),
      ),
    ).toBeInTheDocument();
    expect(sent).toEqual(["sync"]);
  });

  it("stops syncing the account after a confirmation", async () => {
    const bodies: unknown[] = [];
    await renderApp(`/accounts/${checkingID}?tab=sync`, {
      fetch: api({
        [`PUT /api/v1/connections/${connectionID}/accounts/${externalCheckingID}`]:
          async (req) => {
            bodies.push(await req.json());
            return json(200, {});
          },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["sync.stop"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["sync.stopConfirm"],
      }),
    );
    await waitFor(() => {
      expect(bodies).toEqual([{ ignored: true }]);
    });
  });
});

describe("Tabs on a phone (ADR 027, S5)", () => {
  it("draws no tab strip and shows the activity for a desktop-only tab", async () => {
    await renderApp(`/accounts/${checkingID}?tab=imports`, {
      width: 390,
      fetch: api(),
    });

    await screen.findByRole("region", { name: catalogEn["account.figures"] });
    expect(
      screen.queryByRole("tablist", { name: catalogEn["account.tabs"] }),
    ).toBeNull();
    expect(
      screen.queryByRole("table", { name: catalogEn["imports.caption"] }),
    ).toBeNull();
  });

  it("keeps the strip with every tab from 600 px", async () => {
    await renderApp(`/accounts/${checkingID}`, { width: 600, fetch: api() });

    const strip = await screen.findByRole("tablist", {
      name: catalogEn["account.tabs"],
    });
    expect(within(strip).getByRole("tab", { name: /^Imports/ })).toBeVisible();
  });
});
