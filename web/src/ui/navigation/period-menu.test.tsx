import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { setViewport } from "@/testing/viewport";
import { PeriodMenu } from "@/ui/navigation/period-menu";

// Spec 2026-11-21-mobile-statement, MS11: on a phone the period is one button that names it and
// opens the choices of the period control.
describe("period menu", () => {
  it("names the whole history when no period is set", () => {
    renderWithProviders(
      <PeriodMenu value={undefined} onChange={() => undefined} />,
      { fetch: fakeApi({}), today: "2026-10-17" },
    );

    expect(
      screen.getByRole("button", { name: "All time" }),
    ).toBeInTheDocument();
  });

  it("opens the choices of the period", async () => {
    renderWithProviders(
      <PeriodMenu value={undefined} onChange={() => undefined} />,
      { fetch: fakeApi({}), today: "2026-10-17" },
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "All time" }));

    expect(
      await screen.findByRole("dialog", { name: "Choose period" }),
    ).toBeInTheDocument();
  });

  it("opens the choices as a sheet on a phone", async () => {
    setViewport(390, "coarse");
    renderWithProviders(
      <PeriodMenu value={undefined} onChange={() => undefined} />,
      { fetch: fakeApi({}), today: "2026-10-17" },
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "All time" }));

    expect(
      await screen.findByRole("dialog", { name: "Choose period" }),
    ).toHaveAttribute("aria-modal", "true");
  });
});
