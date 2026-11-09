import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppearanceAmounts } from "@/features/setup/appearance-amounts";
import { settingsEn } from "@/i18n/catalog-settings.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { storedAppearance } from "@/theme/appearance";

describe("AppearanceAmounts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores the amount colour chosen", async () => {
    renderWithProviders(<AppearanceAmounts />, { fetch: fakeApi({}) });
    const group = screen.getByRole("radiogroup", {
      name: settingsEn["studio.amountTone"],
    });
    const sign = within(group).getByRole("radio", {
      name: settingsEn["studio.amountTone.sign"],
    });

    await userEvent.click(sign);

    expect(sign).toBeChecked();
    expect(localStorage.getItem("equori.amountTone")).toBe("sign");
    expect(storedAppearance().amountTone).toBe("sign");
  });

  it("stores the summary figure format chosen", async () => {
    renderWithProviders(<AppearanceAmounts />, { fetch: fakeApi({}) });
    const group = screen.getByRole("radiogroup", {
      name: settingsEn["studio.summaryAmounts"],
    });
    const compact = within(group).getByRole("radio", {
      name: settingsEn["studio.summaryAmounts.compact"],
    });

    await userEvent.click(compact);

    expect(compact).toBeChecked();
    expect(localStorage.getItem("equori.summaryAmounts")).toBe("compact");
    expect(storedAppearance().summaryAmounts).toBe("compact");
  });
});
