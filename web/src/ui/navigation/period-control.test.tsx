import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { PeriodControl } from "@/ui/navigation/period-control";

describe("period control", () => {
  it("returns to the month of today", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <PeriodControl
        value={{ from: "2025-03-01", to: "2025-03-31" }}
        onChange={onChange}
      />,
      { fetch: fakeApi({}), today: "2026-10-17" },
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Today" }));

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("names a period that holds today and disables the return on it", () => {
    renderWithProviders(
      <PeriodControl
        value={{ from: "2026-01-01", to: "2026-12-31" }}
        onChange={() => undefined}
      />,
      { fetch: fakeApi({}), today: "2026-10-17" },
    );

    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "2026, current period" }),
    ).toBeInTheDocument();
  });

  it("offers the return with no period", () => {
    renderWithProviders(
      <PeriodControl value={undefined} onChange={() => undefined} />,
      {
        fetch: fakeApi({}),
        today: "2026-10-17",
      },
    );

    expect(screen.getByRole("button", { name: "Today" })).toBeEnabled();
  });

  it("reserves the width of the widest month of the year", () => {
    renderWithProviders(
      <PeriodControl
        value={{ from: "2026-05-01", to: "2026-05-31" }}
        onChange={() => undefined}
      />,
      { fetch: fakeApi({}), today: "2026-10-17" },
    );

    const label = screen.getByText("May 2026");

    expect(label.getAttribute("data-widest")?.split("\n")).toContain(
      "September 2026",
    );
  });
});
