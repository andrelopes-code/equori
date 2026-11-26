import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SelectionBar } from "@/features/transactions/selection/selection-bar";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { setViewport } from "@/testing/viewport";

describe("SelectionBar", () => {
  it("opens the category choice as a sheet on a phone", async () => {
    setViewport(390, "coarse");
    renderWithProviders(
      <SelectionBar
        count={2}
        amount={-1000}
        busy={false}
        open
        onOpenChange={() => undefined}
        onClear={() => undefined}
        onVoid={() => undefined}
        onCategorize={() => undefined}
      />,
      { fetch: fakeApi({}) },
    );

    expect(
      await screen.findByRole("dialog", { name: "Categorize 2 transactions" }),
    ).toHaveAttribute("aria-modal", "true");
  });
});
