import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CompareIndexersDialog } from "@/features/portfolio/contribution-plan/month/compare-indexers-dialog";
import { FundReportDialog } from "@/features/portfolio/contribution-plan/month/fund-report-dialog";
import { catalogEn } from "@/i18n/catalog.en";
import { instrumentsApi } from "@/testing/instruments-api";
import { renderWithProviders } from "@/testing/render-app";

describe("CompareIndexersDialog", () => {
  it("states the question of the comparison and closes from its header", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <CompareIndexersDialog
        amount={{ amount: 110000, currency: "BRL" }}
        open
        onClose={onClose}
      />,
      { fetch: instrumentsApi() },
    );
    const user = userEvent.setup();

    const dialog = await screen.findByRole("dialog", {
      name: catalogEn["contributionPlan.compareIndexers.title"],
    });
    expect(dialog).toHaveAccessibleDescription(
      catalogEn["calc.indexer-comparison.question"],
    );

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe("FundReportDialog", () => {
  it("closes from its header", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <FundReportDialog code="CDB1" quote="BRL" open onClose={onClose} />,
      { fetch: instrumentsApi() },
    );
    const user = userEvent.setup();

    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
