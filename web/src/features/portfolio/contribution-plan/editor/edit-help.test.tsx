import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { EditHelp } from "@/features/portfolio/contribution-plan/editor/edit-help";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

it("explains the order of the chosen assets and the rules", async () => {
  renderWithProviders(<EditHelp />, { fetch: fakeApi({}) });

  await userEvent.setup().click(
    screen.getByRole("button", {
      name: catalogEn["contributionPlan.helpLabel"],
    }),
  );

  expect(
    await screen.findByText(catalogEn["contributionPlan.help.rules"]),
  ).toBeVisible();
});
