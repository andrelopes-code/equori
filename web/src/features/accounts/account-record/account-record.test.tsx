import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  brokerageID,
  itauID,
  stockID,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

function page(name: string) {
  const items = accountFixtures.map((a) =>
    a.id === brokerageID ? { ...a, name } : a,
  );

  return fakeApi(
    accountRoutes({
      [`GET /api/v1/accounts/${brokerageID}`]: () =>
        json(
          200,
          items.find((x) => x.id === brokerageID),
        ),
      "GET /api/v1/accounts": () =>
        json(200, { items: items.filter((a) => a.id !== stockID) }),
      "GET /api/v1/instruments": () =>
        json(200, {
          items: [
            { code: "BRL", type: "currency", scale: 2, name: "Real" },
            { code: "AUVP11", type: "fund", scale: 0, name: "AUVP" },
          ],
        }),
    }),
  );
}

describe("Account record", () => {
  it("BC10: tells a leaf named after an investment that it is a cash account", async () => {
    await renderApp(`/accounts/${brokerageID}`, { fetch: page("AUVP11") });

    expect(
      await screen.findByText(catalogEn["brokerage.cashLeafNotice"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: catalogEn["positions.recordBuy"] }),
    ).toHaveAttribute(
      "href",
      `/transactions/new?kind=trade&brokerage_id=${brokerageID}`,
    );
  });

  it("BC10: shows no notice for a leaf with another name", async () => {
    await renderApp(`/accounts/${brokerageID}`, { fetch: page("Corretora") });

    await screen.findByRole("heading", { name: "Corretora" });
    expect(
      screen.queryByText(catalogEn["brokerage.cashLeafNotice"]),
    ).not.toBeInTheDocument();
  });

  it("BC19: offers to close a cash account with no entry", async () => {
    const bodies: unknown[] = [];

    await renderApp(`/accounts/${brokerageID}`, {
      fetch: idlePage({
        [`POST /api/v1/accounts/${idleCashID}/close`]: async (req) => {
          bodies.push(await req.json());

          return json(200, { ...idleCash, closed_on: "2026-10-17" });
        },
      }),
    });

    expect(
      await screen.findByText(
        "Caixa has no entry. Close it and trades use Itaú conta without asking.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close Caixa" }));

    expect((await screen.findAllByText("Caixa closed")).length).toBeGreaterThan(
      0,
    );
    expect(bodies).toEqual([{ closed_on: "2026-10-17" }]);
  });

  it("BC19: shows no notice for a cash account with an entry", async () => {
    await renderApp(`/accounts/${brokerageID}`, {
      fetch: idlePage({
        "GET /api/v1/transactions": (req) => {
          const account = new URL(req.url).searchParams.get("account_id");

          return json(200, {
            items: account === idleCashID ? [{ id: "t1" }] : [],
          });
        },
      }),
    });

    await screen.findByRole("heading", { name: "Corretora" });
    await screen.findByRole("tab", {
      name: catalogEn["account.tab.positions"],
    });
    expect(
      screen.queryByRole("button", { name: "Close Caixa" }),
    ).not.toBeInTheDocument();
  });
});

const idleCashID = "a1000000-0000-4000-8000-0000000000f1";
const itauCheckingID = "a1000000-0000-4000-8000-0000000000f2";

const idleCash = {
  id: idleCashID,
  name: "Caixa",
  class: "asset",
  kind: "brokerage",
  currency: "BRL",
  opened_on: "2026-01-01",
  yield_mode: "none",
  parent_id: brokerageID,
  institution_id: itauID,
};

// A brokerage of Itaú with a cash account, a holding and one checking account of Itaú.
function idlePage(routes: Parameters<typeof accountRoutes>[0]) {
  const items = [
    ...accountFixtures.map((a) =>
      a.id === brokerageID ? { ...a, institution_id: itauID } : a,
    ),
    idleCash,
    {
      ...idleCash,
      id: itauCheckingID,
      name: "Itaú conta",
      kind: "checking",
      parent_id: undefined,
    },
  ];

  return fakeApi(
    accountRoutes({
      [`GET /api/v1/accounts/${brokerageID}`]: () =>
        json(
          200,
          items.find((x) => x.id === brokerageID),
        ),
      "GET /api/v1/accounts": () => json(200, { items }),
      ...routes,
    }),
  );
}
