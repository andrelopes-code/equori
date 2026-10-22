import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { MASK } from "@/privacy/mask";
import {
  accountRoutes,
  brokerageID,
  checkingID,
  money,
  stockID,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

function api() {
  return fakeApi(
    accountRoutes({
      [`GET /api/v1/accounts/${checkingID}/reconciliation`]: () =>
        json(200, { last_reconciled_on: "2026-09-30" }),
      [`GET /api/v1/accounts/${checkingID}/balance`]: (req) =>
        json(200, {
          account_id: checkingID,
          date: "2026-10-17",
          basis: new URL(req.url).searchParams.get("basis"),
          balance: money(524055),
        }),
      [`GET /api/v1/accounts/${checkingID}/projection`]: () =>
        json(200, {
          account_id: checkingID,
          from: "2026-10-17",
          to: "2026-11-16",
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
    }),
  );
}

async function settle() {
  await waitFor(() => {
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("accounts with the amounts hidden", () => {
  it("masks the balance sheet and the account cards", async () => {
    hideAmounts();
    const { container } = await renderApp("/accounts", { fetch: api() });
    await screen.findByRole("region", { name: "Balance sheet figures" });
    await settle();
    expect(screen.getAllByText(new RegExp(MASK)).length).toBeGreaterThan(0);
    expectNoAmounts(container, ["15,390.55", "14,500.00", "890.55"]);
  });

  it.each([
    ["a checking account", checkingID],
    ["a brokerage account", brokerageID],
  ])("masks every tab of %s", async (_name, id) => {
    hideAmounts();
    const { container } = await renderApp(`/accounts/${id}`, {
      fetch: api(),
    });
    const tabs = await screen.findAllByRole("tab");
    for (const tab of tabs) {
      await userEvent.click(tab);
      await settle();
      expectNoAmounts(container, []);
    }
  });

  it("masks the quantity and the cost of a position", async () => {
    hideAmounts();
    const { container } = await renderApp(
      `/accounts/${brokerageID}?tab=positions`,
      {
        fetch: fakeApi(
          accountRoutes({
            "GET /api/v1/positions": () =>
              json(200, {
                items: [
                  {
                    account_id: stockID,
                    instrument: "PETR4",
                    quantity: money(1234, "PETR4"),
                    cost_basis: money(300000),
                    average_cost: "30.00",
                    market_value: money(380000),
                  },
                ],
              }),
          }),
        ),
      },
    );
    const table = await screen.findByRole("table", {
      name: "Positions",
    });
    await settle();
    expect(table).toHaveTextContent("PETR4");
    expectNoAmounts(container, ["1234", "30.00"]);
  });

  it("masks the batch page", async () => {
    hideAmounts();
    const { container } = await renderApp(`/accounts/${checkingID}/import`, {
      fetch: api(),
    });
    await settle();
    expectNoAmounts(container, []);
  });
});
