import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { PrivacyToggle } from "@/app/shell/privacy-toggle";

describe("PrivacyToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is a pressed button that hides the amounts and remembers it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PrivacyToggle />, { fetch: fakeApi({}) });
    const button = screen.getByRole("button", {
      name: catalogEn["privacy.hide"],
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("equori.privacy")).toBe("hidden");
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem("equori.privacy")).toBeNull();
  });
});
