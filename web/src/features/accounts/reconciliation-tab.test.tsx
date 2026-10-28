import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountRoutes,
  checkingID,
  money,
  reserveID,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Route = (req: Request) => Response | Promise<Response>;

function assertion(
  id: string,
  date: string,
  amount: number,
  reconciled = true,
) {
  return {
    id,
    account_id: reserveID,
    date,
    amount: money(amount),
    source: "manual",
    recorded_at: `${date}T12:00:00Z`,
    reconciled,
  };
}

function api(id: string, overrides: Record<string, Route> = {}) {
  return fakeApi(
    accountRoutes({
      [`GET /api/v1/accounts/${id}/reconciliation`]: () =>
        json(200, { last_reconciled_on: "2026-10-01" }),
      [`GET /api/v1/accounts/${id}/balance-assertions`]: () =>
        json(200, { items: [assertion("a0", "2026-10-01", 1000000)] }),
      [`GET /api/v1/accounts/${id}/unconfirmed`]: () =>
        json(200, { items: [] }),
      ...overrides,
    }),
  );
}

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

async function openForm() {
  await userEvent.click(
    await screen.findByRole("button", {
      name: catalogEn["reconciliation.record"],
    }),
  );
  // Owner review item 13: the form opens in a dialog, so the click visibly changes the screen.
  return screen.findByRole("dialog", {
    name: catalogEn["reconciliation.formTitle"],
  });
}

describe("Reconciliation", () => {
  it("records the institution's balance as a manual assertion", async () => {
    const bodies: unknown[] = [];
    await renderApp(`/accounts/${reserveID}?tab=reconciliation`, {
      fetch: api(reserveID, {
        [`POST /api/v1/accounts/${reserveID}/balance-assertions`]: async (
          req,
        ) => {
          bodies.push(await req.json());
          return json(201, {
            assertion: assertion("a1", "2026-10-17", 1008341),
            difference: money(8341),
            resolution: "yield",
            resolution_transaction_id: "tx-yield",
          });
        },
      }),
    });
    const form = await openForm();
    await userEvent.type(
      within(form).getByRole("textbox", {
        name: catalogEn["reconciliation.amount"],
      }),
      "1008341",
    );
    await userEvent.click(
      within(form).getByRole("button", {
        name: catalogEn["reconciliation.submit"],
      }),
    );
    expect(
      await screen.findByText(
        words("reconciliation.result.yield", { amount: "R$83.41" }),
      ),
    ).toBeInTheDocument();
    expect(bodies).toEqual([
      { date: "2026-10-17", amount: money(1008341), source: "manual" },
    ]);
    expect(
      screen.getByRole("link", {
        name: catalogEn["reconciliation.viewTransaction"],
      }),
    ).toHaveAttribute("href", "/transactions/tx-yield");
  });

  it("opens the form from the address", async () => {
    await renderApp(`/accounts/${reserveID}?tab=reconciliation&assert=true`, {
      fetch: api(reserveID),
    });
    expect(
      await screen.findByRole("dialog", {
        name: catalogEn["reconciliation.formTitle"],
      }),
    ).toBeInTheDocument();
  });

  it("offers both resolutions for an open difference and records an adjustment", async () => {
    const bodies: unknown[] = [];
    await renderApp(`/accounts/${checkingID}?tab=reconciliation`, {
      fetch: api(checkingID, {
        [`GET /api/v1/accounts/${checkingID}/reconciliation`]: () =>
          json(200, {
            last_reconciled_on: "2026-09-30",
            open_difference: {
              assertion_id: "a9",
              date: "2026-10-15",
              difference: money(-1000),
            },
          }),
        "POST /api/v1/balance-assertions/a9/resolve": async (req) => {
          bodies.push(await req.json());
          return json(200, {
            assertion: assertion("a9", "2026-10-15", 523055),
            difference: money(-1000),
            resolution: "adjustment",
            resolution_transaction_id: "tx-adj",
          });
        },
      }),
    });
    expect(
      await screen.findByText(
        words("reconciliation.open", {
          amount: "−R$10.00",
          date: "10/15/2026",
        }),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: catalogEn["reconciliation.resolve.added"],
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: words("reconciliation.resolve.adjustment", {
          amount: "−R$10.00",
        }),
      }),
    );
    await waitFor(() => {
      expect(bodies).toEqual([{ resolution: "adjustment" }]);
    });
  });

  it("records a positive difference as yield", async () => {
    const bodies: unknown[] = [];
    const open = (difference: number) => ({
      [`GET /api/v1/accounts/${checkingID}/reconciliation`]: () =>
        json(200, {
          last_reconciled_on: "2026-09-30",
          open_difference: {
            assertion_id: "a9",
            date: "2026-10-15",
            difference: money(difference),
          },
        }),
    });
    await renderApp(`/accounts/${checkingID}?tab=reconciliation`, {
      fetch: api(checkingID, {
        ...open(8),
        "POST /api/v1/balance-assertions/a9/resolve": async (req) => {
          bodies.push(await req.json());
          return json(200, {
            assertion: assertion("a9", "2026-10-15", 523055),
            difference: money(8),
            resolution: "yield",
            resolution_transaction_id: "tx-yield",
          });
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: words("reconciliation.resolve.yield", { amount: "R$0.08" }),
      }),
    );
    await waitFor(() => {
      expect(bodies).toEqual([{ resolution: "yield" }]);
    });
  });

  it("offers no yield for a negative difference", async () => {
    await renderApp(`/accounts/${checkingID}?tab=reconciliation`, {
      fetch: api(checkingID, {
        [`GET /api/v1/accounts/${checkingID}/reconciliation`]: () =>
          json(200, {
            open_difference: {
              assertion_id: "a9",
              date: "2026-10-15",
              difference: money(-8),
            },
          }),
      }),
    });
    await screen.findByRole("button", {
      name: catalogEn["reconciliation.resolve.added"],
    });
    expect(
      screen.queryByRole("button", { name: /yield/i }),
    ).not.toBeInTheDocument();
  });

  it("re-reads the status when the missing transactions do not cover the difference", async () => {
    let reads = 0;
    await renderApp(`/accounts/${checkingID}?tab=reconciliation`, {
      fetch: api(checkingID, {
        [`GET /api/v1/accounts/${checkingID}/reconciliation`]: () => {
          reads += 1;
          return json(200, {
            open_difference: {
              assertion_id: "a9",
              date: "2026-10-15",
              difference: money(reads === 1 ? -1000 : -400),
            },
          });
        },
        "POST /api/v1/balance-assertions/a9/resolve": () =>
          problem(409, "difference_remains"),
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["reconciliation.resolve.added"],
      }),
    );
    expect(
      await screen.findByText(
        words("reconciliation.remains", { amount: "−R$4.00" }),
      ),
    ).toBeInTheDocument();
  });

  it("lists earlier assertions page by page", async () => {
    await renderApp(`/accounts/${reserveID}?tab=reconciliation`, {
      fetch: api(reserveID, {
        [`GET /api/v1/accounts/${reserveID}/balance-assertions`]: (req) =>
          new URL(req.url).searchParams.get("cursor") === null
            ? json(200, {
                items: [assertion("a2", "2026-10-01", 1000000)],
                next_cursor: "c2",
              })
            : json(200, {
                items: [assertion("a1", "2026-09-01", 990000, false)],
              }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["reconciliation.history"],
    });
    // The date and the day it was recorded read the same here.
    await within(table).findAllByText("10/01/2026");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["reconciliation.more"] }),
    );
    expect(
      (await within(table).findAllByText("09/01/2026")).length,
    ).toBeGreaterThan(0);
  });

  it("lists the entries no institution line confirmed", async () => {
    await renderApp(`/accounts/${checkingID}?tab=reconciliation`, {
      fetch: api(checkingID, {
        [`GET /api/v1/accounts/${checkingID}/unconfirmed`]: () =>
          json(200, {
            items: [
              {
                transaction_id: "t1",
                date: "2026-09-01",
                amount: money(-5000),
                description: "Padaria",
              },
              {
                transaction_id: "t2",
                date: "2026-09-20",
                amount: money(-7000),
                description: "Farmácia",
              },
            ],
          }),
      }),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["reconciliation.unconfirmed"],
    });
    await within(table).findByText("Padaria");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Padaria"),
      expect.stringContaining("Farmácia"),
    ]);
    // A133: the note says why an entry is listed and what resolves it.
    expect(
      screen.getByText(
        "The bank reported no line for these entries. A duplicated or mistyped entry is resolved by voiding or correcting the transaction. A correct entry is confirmed when the balance the bank reports matches.",
      ),
    ).toBeInTheDocument();
  });

  it("unlocks the reconciliation from a date", async () => {
    const bodies: unknown[] = [];
    await renderApp(`/accounts/${checkingID}?tab=reconciliation`, {
      fetch: api(checkingID, {
        [`POST /api/v1/accounts/${checkingID}/unlock`]: async (req) => {
          bodies.push(await req.json());
          return json(200, {});
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["account.more"] }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["account.unlock"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["unlock.confirm"] }),
    );
    await waitFor(() => {
      expect(bodies).toEqual([{ from: "2026-10-01" }]);
    });
  });
});
