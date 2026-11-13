import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

import { HelpTip } from "@/ui/display/help-tip";

describe("HelpTip", () => {
  it("names the term and opens its explanation on hover", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HelpTip label="About “Gain”" text="Closing minus opening." />,
      { fetch: fakeApi({}) },
    );

    const button = screen.getByRole("button", { name: "About “Gain”" });
    await user.hover(button);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Closing minus opening.",
    );
  });
});
