import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CalculatorDetails } from "@/features/calculators/calculator-frame/calculator-details";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

describe("CalculatorDetails", () => {
  it("is closed and the trigger shows the title and the size", () => {
    renderWithProviders(
      <CalculatorDetails title="Month by month" size="360 months">
        <p>rows</p>
      </CalculatorDetails>,
      { fetch: fakeApi({}) },
    );

    const trigger = screen.getByRole("button", { name: /Month by month/ });

    expect(trigger).toHaveTextContent("360 months");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the children when opened", async () => {
    renderWithProviders(
      <CalculatorDetails title="Month by month" size="360 months">
        <p>rows</p>
      </CalculatorDetails>,
      { fetch: fakeApi({}) },
    );

    const trigger = screen.getByRole("button", { name: /Month by month/ });

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("rows")).toBeVisible();
  });
});
