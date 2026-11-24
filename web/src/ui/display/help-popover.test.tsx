import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

import { HelpPopover } from "@/ui/display/help-popover";

describe("HelpPopover", () => {
  it("stands in the line of its title and opens its text on a press", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HelpPopover label="About the criteria">
        A yes or no question.
      </HelpPopover>,
      { fetch: fakeApi({}) },
    );

    const button = screen.getByRole("button", { name: "About the criteria" });
    await user.click(button);

    expect(button).toHaveAttribute("data-inline");
    expect(
      await screen.findByRole("dialog", { name: "About the criteria" }),
    ).toHaveTextContent("A yes or no question.");
  });
});
