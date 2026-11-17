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

  it("reserves the width of the widest month of the year", () => {
    renderWithProviders(
      <MonthControl value="2026-05" onChange={() => undefined} label="Month" />,
      { fetch: fakeApi({}) },
    );

    const label = screen.getByText("May 2026").closest("[data-widest]");

    expect(label?.getAttribute("data-widest")?.split("\n")).toContain(
      "September 2026",
    );
  });

  it("returns to the month of today", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MonthControl value="2025-03" onChange={onChange} label="Month" />,
      { fetch: fakeApi({}), today: "2026-10-17" },
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Today" }));

    expect(onChange).toHaveBeenCalledWith("2026-10");
  });

  it("names the month of today and disables the return on it", () => {
    renderWithProviders(
      <MonthControl value="2026-10" onChange={() => undefined} label="Month" />,
      { fetch: fakeApi({}), today: "2026-10-17" },
    );

    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "October 2026, current period" }),
    ).toBeInTheDocument();
  });

  it("draws no return when the month of today is past its last month", () => {
    renderWithProviders(
      <MonthControl
        value="2026-08"
        max="2026-09"
        onChange={() => undefined}
        label="Month"
      />,
      { fetch: fakeApi({}), today: "2026-10-17" },
    );

    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
  });
});
