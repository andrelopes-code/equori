import { screen, waitFor } from "@testing-library/react";
import { describe, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { instrumentsApi as api } from "@/testing/instruments-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

// IP15: a unit price and the sums of a position are masked with the amounts.
describe("Instrument page in privacy mode", () => {
  it("writes no price and no amount", async () => {
    hideAmounts();
    const { container } = await renderApp("/instruments/PETR4", {
      fetch: api(),
    });
    await screen.findByRole("group", { name: /^Quote of 10\/16\/2026/ });
    await screen.findByText(catalogEn["instrument.figures.low"]);
    await screen.findByRole("region", {
      name: catalogEn["instrument.position.figures"],
    });
    await waitFor(() => {
      expectNoAmounts(container, ["38.45", "38.10", "3,845", "3845"]);
    });
  });
});
