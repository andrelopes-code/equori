import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

// Spec 2026-11-15 section 7: a status the tools write as a code word reads in the reader's language.
describe("ProposalChanges", () => {
  it("writes a known status in the reader's language", () => {
    renderWithProviders(
      <ProposalChanges
        changes={[
          {
            field: "status",
            before: { text: "open difference" },
            after: { text: "needs_review" },
          },
        ]}
      />,
      { fetch: fakeApi({}) },
    );

    expect(
      screen.getByText(catalogEn["assistant.value.needs_review"]),
    ).toBeVisible();
    expect(
      screen.getByText(catalogEn["assistant.value.open_difference"]),
    ).toBeInTheDocument();
  });

  it("keeps an unknown status and any other field as written", () => {
    renderWithProviders(
      <ProposalChanges
        changes={[
          { field: "status", after: { text: "brand_new_state" } },
          { field: "description", after: { text: "active" } },
        ]}
      />,
      { fetch: fakeApi({}) },
    );

    expect(screen.getByText("brand_new_state")).toBeVisible();
    expect(screen.getByText("active")).toBeVisible();
  });
});
