import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { ConnectionInvestments } from "@/features/accounts/connections/connection-investments";
import { catalogEn } from "@/i18n/catalog.en";
import { chooseAccount } from "@/testing/account-choice";
import { connectionID } from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import {
  brokerID,
  dividendsID,
  investmentRoutes,
} from "@/testing/investment-api";
import { renderWithProviders } from "@/testing/render-app";

type Connection = components["schemas"]["Connection"];
type Movement = components["schemas"]["InvestmentMovement"];

const connection = { id: connectionID, name: "Nubank" } as Connection;
const investmentID = "d1000000-0000-4000-8000-000000000001";

function movement(over: Partial<Movement> & Pick<Movement, "id">): Movement {
  return {
    investment_id: investmentID,
    kind: "buy",
    date: "2026-11-03",
    amount: { amount: 100000, currency: "BRL" },
    state: "pending",
    proposal: "application",
    ...over,
  };
}

// S541: an application of 1000.00 and the interest of 12.34 of one CDB.
const application = movement({ id: "m1" });
const income = movement({
  id: "m2",
  kind: "income",
  date: "2026-11-10",
  amount: { amount: 1234, currency: "BRL" },
  proposal: "income",
});

function investments(movements: Movement[]) {
  return {
    investments: [
      {
        id: investmentID,
        name: "CDB Banco X",
        type: "fixed_income",
        subtype: "cdb",
        issuer: "Banco X",
        index_id: "cdi",
        percent_of_index_bp: 10000,
        spread_bp: 0,
        has_terms: true,
        balance: { amount: 100000, currency: "BRL" },
        balance_date: "2026-11-10",
        movements,
      },
    ],
  };
}

function show(movements: Movement[], routes: Record<string, never> = {}) {
  const sent: { path: string; body: unknown }[] = [];
  const answer = (state: Movement["state"]) => async (req: Request) => {
    const text = await req.text();
    sent.push({
      path: new URL(req.url).pathname,
      body: text === "" ? null : (JSON.parse(text) as unknown),
    });
    return json(200, { ...application, state });
  };
  const fetch = fakeApi({
    ...investmentRoutes([]),
    [`GET /api/v1/connections/${connectionID}/investments`]: () =>
      json(200, investments(movements)),
    "POST /api/v1/investment-movements/m1/confirm": answer("confirmed"),
    "POST /api/v1/investment-movements/m2/confirm": answer("confirmed"),
    "POST /api/v1/investment-movements/m3/confirm": answer("confirmed"),
    "POST /api/v1/investment-movements/m1/dismiss": answer("dismissed"),
    ...routes,
  });
  renderWithProviders(<ConnectionInvestments connection={connection} />, {
    fetch,
  });
  return sent;
}

async function rowAt(index: number) {
  const row = within(await screen.findByRole("list")).getAllByRole("listitem")[
    index
  ];
  if (row === undefined) throw new Error(`no row ${String(index)}`);
  return row;
}

const confirm = catalogEn["connection.investments.confirm"];

describe("ConnectionInvestments", () => {
  it("draws one row per movement with its word and amount", async () => {
    show([income, application]);

    const first = await rowAt(0);
    const second = await rowAt(1);

    expect(first).toHaveTextContent(
      "11/03/2026 · New application · CDB Banco X",
    );
    expect(first).toHaveTextContent(/1,000\.00/);
    expect(second).toHaveTextContent("11/10/2026 · Interest · CDB Banco X");
    expect(second).toHaveTextContent(/12\.34/);
  });

  it("confirms an application with the brokerage", async () => {
    const sent = show([application, income]);

    const row = await rowAt(0);
    await userEvent.click(within(row).getByRole("button", { name: confirm }));
    await chooseAccount(catalogEn["connection.investments.brokerage"], "XP");
    const dialog = await screen.findByRole("dialog", {
      name: catalogEn["connection.investments.confirmTitle"],
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: confirm }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          path: "/api/v1/investment-movements/m1/confirm",
          body: { brokerage_id: brokerID },
        },
      ]);
    });
  });

  it("confirms an income with its category", async () => {
    const sent = show([application, income]);

    const row = await rowAt(1);
    await userEvent.click(within(row).getByRole("button", { name: confirm }));
    const dialog = await screen.findByRole("dialog", {
      name: catalogEn["connection.investments.incomeTitle"],
    });
    const input = within(dialog).getByRole("combobox", {
      name: catalogEn["connection.investments.category"],
    });
    await userEvent.click(input);
    await userEvent.type(input, "Dividends");
    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(
      within(dialog).getByRole("button", { name: confirm }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          path: "/api/v1/investment-movements/m2/confirm",
          body: { category_id: dividendsID },
        },
      ]);
    });
  });

  it("confirms a contribution with an empty body", async () => {
    const contribution = movement({
      id: "m3",
      proposal: "contribution",
      date: "2026-11-12",
    });
    const sent = show([contribution]);

    const row = await rowAt(0);
    await userEvent.click(within(row).getByRole("button", { name: confirm }));

    await waitFor(() => {
      expect(sent).toEqual([
        { path: "/api/v1/investment-movements/m3/confirm", body: {} },
      ]);
    });
  });

  it("dismisses a pending movement", async () => {
    const sent = show([application]);

    const row = await rowAt(0);
    await userEvent.click(
      within(row).getByRole("button", {
        name: catalogEn["connection.investments.dismiss"],
      }),
    );

    await waitFor(() => {
      expect(sent.map((s) => s.path)).toEqual([
        "/api/v1/investment-movements/m1/dismiss",
      ]);
    });
  });

  it("shows the state word and Undo on a confirmed row", async () => {
    show([{ ...application, state: "confirmed" }]);

    const row = await rowAt(0);

    expect(row).toHaveTextContent(
      catalogEn["connection.investments.state.confirmed"],
    );
    expect(
      within(row).getByRole("button", { name: catalogEn["links.undo"] }),
    ).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: confirm })).toBeNull();
  });

  it("draws no button on the tax of a redemption", async () => {
    show([movement({ id: "m4", kind: "tax", proposal: "tax_of_sale" })]);

    const row = await rowAt(0);

    expect(within(row).queryAllByRole("button")).toHaveLength(0);
  });

  it("draws no section for a connection without movements", async () => {
    show([]);

    await waitFor(() => {
      expect(screen.queryByRole("list")).toBeNull();
    });
    expect(screen.queryByText(catalogEn["connection.investments"])).toBeNull();
  });

  it("shows the text of a 409 investment_not_applied", async () => {
    const contribution = movement({ id: "m3", proposal: "contribution" });
    show([contribution], {
      "POST /api/v1/investment-movements/m3/confirm": (() =>
        problem(409, "investment_not_applied")) as never,
    });

    const row = await rowAt(0);
    await userEvent.click(within(row).getByRole("button", { name: confirm }));

    expect(
      await screen.findByText(catalogEn["problem.investment_not_applied"]),
    ).toBeInTheDocument();
  });
});
