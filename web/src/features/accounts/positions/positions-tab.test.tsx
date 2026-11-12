import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes, brokerageID } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

describe("Positions tab empty state", () => {
  it("BC9: offers to record a buy in this brokerage", async () => {
    await renderApp(`/accounts/${brokerageID}?tab=positions`, {
      fetch: fakeApi(
        accountRoutes({
          "GET /api/v1/positions": () => json(200, { items: [] }),
        }),
      ),
    });

    expect(
      await screen.findByText(catalogEn["positions.empty"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: catalogEn["positions.recordBuy"] }),
    ).toHaveAttribute(
      "href",
      `/transactions/new?kind=trade&brokerage_id=${brokerageID}`,
    );
  });
});
