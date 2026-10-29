import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { MonthControl } from "@/ui/month-control";
import { PeriodControl } from "@/ui/period-control";

// Owner decision: the trigger of a period or a month shows its label alone, with no calendar
// glyph, whatever the installed Slotted version draws.
describe("period and month triggers", () => {
  it("draws the period trigger without an icon", () => {
    const { container } = renderWithProviders(
      <PeriodControl
        value={{ from: "2026-10-01", to: "2026-10-31" }}
        onChange={() => undefined}
      />,
      { fetch: fakeApi({}) },
    );

    const trigger = container.querySelector("button[aria-expanded]");

    expect(trigger).not.toBeNull();
    expect(trigger?.querySelector('[data-ui="icon"]')).toBeNull();
  });

  it("draws the month trigger without an icon", () => {
    const { container } = renderWithProviders(
      <MonthControl value="2026-10" onChange={() => undefined} label="Month" />,
      { fetch: fakeApi({}) },
    );

    const trigger = container.querySelector("button[aria-expanded]");

    expect(trigger).not.toBeNull();
    expect(trigger?.querySelector('[data-ui="icon"]')).toBeNull();
  });
});
