import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PeriodTrigger } from "@/ui/navigation/period-trigger";

describe("PeriodTrigger", () => {
  it("draws the mark while the period holds today", () => {
    const { container } = render(
      <PeriodTrigger current widest={["May 2026", "September 2026"]}>
        May 2026
      </PeriodTrigger>,
    );

    expect(container.querySelectorAll("[data-period-mark]")).toHaveLength(1);
  });

  it("draws no mark on another period and keeps the widest texts out of the name", () => {
    const { container } = render(
      <PeriodTrigger current={false} widest={["May 2026", "September 2026"]}>
        May 2026
      </PeriodTrigger>,
    );

    expect(container.querySelector("[data-period-mark]")).toBeNull();
    expect(screen.getByRole("button", { name: "May 2026" })).toHaveAttribute(
      "data-widest",
    );
  });
});
