import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

describe("DetailDialog", () => {
  it("DL2: the body is absent before the trigger is pressed and present after", async () => {
    renderWithProviders(
      <DetailDialog title="T" description="D" summary="S" triggerLabel="Open">
        <p>Body</p>
      </DetailDialog>,
      { fetch: fakeApi({}) },
    );

    expect(screen.queryByText("Body")).toBeNull();
    expect(screen.getByText("S")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(await screen.findByText("Body")).toBeVisible();
    expect(screen.getByRole("dialog", { name: "T" })).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.layer.close"] }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Body")).toBeNull();
    });
  });
});
