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

  it("marks the last source current", () => {
    renderWithProviders(
      <TurnActivity steps={["list_accounts", "search_transactions"]} running />,
      { fetch: fakeApi({}) },
    );

    const first = screen
      .getByText(catalogEn["assistant.step.list_accounts"])
      .closest("li");
    const last = screen
      .getByText(catalogEn["assistant.step.search_transactions"])
      .closest("li");

    expect(last).toHaveAttribute("aria-current", "step");
    expect(first).not.toHaveAttribute("aria-current");
  });

  it("stacks at most three source icons", () => {
    renderWithProviders(
      <TurnActivity
        steps={[
          "list_accounts",
          "search_transactions",
          "list_rules",
          "get_help",
        ]}
        running={false}
      />,
      { fetch: fakeApi({}) },
    );

    const trigger = screen.getByRole("button", {
      name: /Sources consulted: 4/,
    });

    expect(trigger.querySelectorAll("[data-source-icon]")).toHaveLength(3);
  });
});
