import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AssetPickerDialog } from "@/features/portfolio/contribution-plan/editor/asset-picker-dialog";
import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { instrumentsApi } from "@/testing/instruments-api";
import { renderWithProviders } from "@/testing/render-app";

describe("AssetPickerDialog", () => {
  it("registers an asset in place and picks it", async () => {
    const onPick = vi.fn();
    const fetch = instrumentsApi({
      "POST /api/v1/instruments": () =>
        json(201, {
          code: "LCI1",
          type: "fixed_income",
          scale: 2,
          name: "LCI One",
          quote_currency: "BRL",
        }),
    });
    renderWithProviders(
      <AssetPickerDialog
        open
        taken={new Map()}
        onPick={onPick}
        onClose={() => undefined}
      />,
      { fetch },
    );
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["contributionPlan.registerAsset"],
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: catalogEn["instruments.define"],
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Code/ }),
      "lci1",
    );
    await user.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["instruments.field.type"],
      }),
    );
    await user.click(
      await screen.findByRole("option", {
        name: catalogEn["instruments.type.fixed_income"],
      }),
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Decimal places/ }),
      "2",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Name/ }),
      "LCI One",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["instruments.save"],
      }),
    );

    await waitFor(() => {
      expect(onPick).toHaveBeenCalledWith({ instrument: "LCI1" });
    });
  });
});
