import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { OpeningLossesSection } from "@/features/portfolio/gain-tax/opening-losses-section";
import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderWithProviders } from "@/testing/render-app";

const brl = (amount: number) => ({ amount, currency: "BRL" });

const set = {
  pools: ["ordinary", "day_trade", "fii"],
  losses: [{ pool: "ordinary", month: "2026-01", amount: brl(100000) }],
};

function open(answer: unknown, puts: unknown[] = []) {
  return renderWithProviders(<OpeningLossesSection />, {
    today: "2026-03-10",
    fetch: portfolioApi({
      "GET /api/v1/gain-tax/opening-losses": () => json(200, answer),
      "PUT /api/v1/gain-tax/opening-losses": async (req) => {
        const body: unknown = await req.json();
        puts.push(body);

        return json(200, set);
      },
    }),
  });
}

describe("opening losses section", () => {
  it("shows the saved loss in the row of its pool", async () => {
    open(set);

    const amount = await screen.findByLabelText("Common operations · Loss");

    expect(amount).toHaveValue("1,000.00");
  });

  it("puts the filled rows and leaves the empty ones out", async () => {
    const puts: unknown[] = [];
    open(set, puts);

    const amount = await screen.findByLabelText("Day trade · Loss");
    const user = userEvent.setup();
    await user.type(amount, "50000");
    const month = screen.getByRole("group", { name: "Day trade · From" });
    await user.click(
      within(month).getByRole("button", { name: "Previous month" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: catalogEn["gainTax.openingLosses.save"],
      }),
    );

    await waitFor(() => {
      expect(puts).toEqual([
        {
          losses: [
            { pool: "ordinary", month: "2026-01", amount: brl(100000) },
            { pool: "day_trade", month: "2026-02", amount: brl(50000) },
          ],
        },
      ]);
    });
  });

  it("draws nothing for a region without pools", async () => {
    const { container } = open({ pools: [], losses: [] });

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
