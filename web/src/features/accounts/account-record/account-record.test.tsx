import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  brokerageID,
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
});
