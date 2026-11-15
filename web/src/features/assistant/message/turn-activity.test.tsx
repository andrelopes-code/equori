import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TurnActivity } from "@/features/assistant/message/turn-activity";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const repeated = [
  "list_accounts",
  "list_accounts",
  "search_transactions",
  "search_transactions",
  "search_transactions",
];

describe("TurnActivity", () => {
  it("lists a source called many times once while the turn runs", () => {
    renderWithProviders(<TurnActivity steps={repeated} running />, {
      fetch: fakeApi({}),
    });

    expect(
      screen.getAllByText(catalogEn["assistant.step.list_accounts"]),
    ).toHaveLength(1);
    expect(
      screen.getAllByText(catalogEn["assistant.step.search_transactions"]),
    ).toHaveLength(1);
  });

  it("counts each source once after the answer", () => {
    renderWithProviders(<TurnActivity steps={repeated} running={false} />, {
      fetch: fakeApi({}),
    });

    expect(
      screen.getByRole("button", { name: /Sources consulted: 2/ }),
    ).toBeVisible();
  });
});
