import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssistantTurn } from "@/features/assistant/message/assistant-turn";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

describe("AssistantTurn", () => {
  it("draws the mark beside the turn", () => {
    const { container } = renderWithProviders(
      <AssistantTurn thinking={false}>Hi</AssistantTurn>,
      { fetch: fakeApi({}) },
    );

    expect(screen.getByText("Hi")).toBeVisible();
    expect(container.querySelectorAll("[data-turn-mark]")).toHaveLength(1);
    expect(container.querySelector("[data-thinking]")).toBeNull();
  });

  it("rings the mark while the turn runs", () => {
    const { container } = renderWithProviders(
      <AssistantTurn thinking>Hi</AssistantTurn>,
      { fetch: fakeApi({}) },
    );

    expect(
      container.querySelector("[data-turn-mark][data-thinking]"),
    ).not.toBeNull();
  });
});
