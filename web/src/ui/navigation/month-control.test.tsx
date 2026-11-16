import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { MonthControl } from "@/ui/navigation/month-control";

describe("month control", () => {
  it("steps past the month it shows without a limit", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MonthControl value="2026-10" onChange={onChange} label="Month" />,
      { fetch: fakeApi({}) },
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Next month" }));

    expect(onChange).toHaveBeenCalledWith("2026-11");
  });

  it("disables the next step on its last month", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MonthControl
        value="2026-11"
        max="2026-11"
        onChange={onChange}
        label="Month"
      />,
      { fetch: fakeApi({}) },
    );

    const next = screen.getByRole("button", { name: "Next month" });
    await userEvent.setup().click(next);

    expect(next).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the previous step on its last month", () => {
    renderWithProviders(
      <MonthControl
        value="2026-11"
        max="2026-11"
        onChange={() => undefined}
        label="Month"
      />,
      { fetch: fakeApi({}) },
    );

    expect(
      screen.getByRole("button", { name: "Previous month" }),
    ).toBeEnabled();
  });
});
