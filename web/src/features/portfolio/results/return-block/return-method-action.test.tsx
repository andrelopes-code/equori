import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { plainReturn } from "@/testing/portfolio-api";
import { renderWithProviders } from "@/testing/render-app";

import { ReturnMethodAction } from "@/features/portfolio/results/return-block/return-method-action";

describe("ReturnMethodAction", () => {
  it.each([
    { from: "2026-01-02", to: "2026-01-31", shown: false },
    { from: "2025-02-01", to: "2026-01-31", shown: true },
  ])(
    "RE6: lists the personal rate from 365 days ($from to $to)",
    async ({ from, to, shown }) => {
      const user = userEvent.setup();
      renderWithProviders(
        <ReturnMethodAction
          report={{ ...plainReturn, profile: "market", period_bp: 120 }}
          from={from}
          to={to}
        />,
        { fetch: fakeApi({}) },
      );

      await user.click(
        screen.getByRole("button", {
          name: catalogEn["portfolio.results.method"],
        }),
      );

      expect(
        await screen.findByText(catalogEn["holdings.method.period"]),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(catalogEn["holdings.method.personal"]) !== null,
      ).toBe(shown);
    },
  );
});
