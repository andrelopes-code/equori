import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TitleTag } from "@/ui/display/title-tag";

describe("TitleTag", () => {
  it("draws the inline form of a sm tag", () => {
    render(<TitleTag>Hidden</TitleTag>);

    const tag = screen.getByText("Hidden").closest('[data-ui="tag"]');

    expect(tag).toHaveAttribute("data-inline");
    expect(tag).toHaveAttribute("data-size", "sm");
  });
});
