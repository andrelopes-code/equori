import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserAvatar } from "@/ui/user-avatar";

describe("UserAvatar", () => {
  it("draws no letters and stays out of the accessibility tree", () => {
    const { container } = render(<UserAvatar seed="ana@equori.local" />);
    const orb = container.firstElementChild as HTMLElement;

    expect(orb.getAttribute("aria-hidden")).toBe("true");
    expect(orb.textContent).toBe("");
  });

  it("takes its slots and angle from the seed", () => {
    const { container, rerender } = render(<UserAvatar seed="ana@a.co" />);
    const orb = () => container.firstElementChild as HTMLElement;
    const first = orb().style.getPropertyValue("--angle");

    expect(orb().style.getPropertyValue("--c1")).toMatch(
      /^var\(--equori-slot-[1-8]\)$/,
    );
    expect(first).toMatch(/^\d+deg$/);

    rerender(<UserAvatar seed="ana@a.co" />);
    expect(orb().style.getPropertyValue("--angle")).toBe(first);

    rerender(<UserAvatar seed="bia@a.co" size="xl" />);
    expect(orb().getAttribute("data-size")).toBe("xl");
    expect(orb().style.getPropertyValue("--angle")).not.toBe(first);
  });
});
