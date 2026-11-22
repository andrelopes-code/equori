import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MissingFactsNotice } from "@/features/portfolio/contribution-plan/editor/missing-facts-notice";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

describe("MissingFactsNotice", () => {
  it("names the assets the filings answer nothing for", () => {
    renderWithProviders(<MissingFactsNotice names={["ITUB4", "BOVA11"]} />, {
      fetch: fakeApi({}),
    });

    expect(
      screen.getByText(
        "No filings for the signals: ITUB4, BOVA11. Without a yes of yours, these assets receive nothing.",
      ),
    ).toBeInTheDocument();
  });

  it("draws nothing when every asset has filings", () => {
    renderWithProviders(<MissingFactsNotice names={[]} />, {
      fetch: fakeApi({}),
    });

    expect(screen.queryByText(/No filings for the signals/)).toBeNull();
  });
});
