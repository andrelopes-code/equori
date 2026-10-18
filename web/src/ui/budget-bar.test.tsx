import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BudgetBar } from "@/ui/budget-bar";

// Complete frontend decision O6.
describe("BudgetBar", () => {
  it("fills the spent share, stops at the end and marks the pace", () => {
    const { container } = render(
      <>
        <BudgetBar share={0.25} pace={0.5} tone="neutral" />
        <BudgetBar share={1.4} tone="danger" />
      </>,
    );
    const [first, second] = container.querySelectorAll(
      '[data-own="budget-bar"]',
    );
    expect(first?.querySelector("span")).toHaveStyle({ inlineSize: "25%" });
    expect(first?.querySelector('[data-part-own="pace"]')).toHaveStyle({
      insetInlineStart: "50%",
    });
    expect(second).toHaveAttribute("data-tone", "danger");
    expect(second?.querySelector("span")).toHaveStyle({ inlineSize: "100%" });
    expect(second?.querySelector('[data-part-own="pace"]')).toBeNull();
  });
});
