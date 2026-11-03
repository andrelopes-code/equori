import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { parseAnswer } from "@/features/assistant/answer-markdown";
import { MessageAnswer } from "@/features/assistant/message-answer";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

describe("MessageAnswer", () => {
  it("says the answer holds no text", () => {
    renderWithProviders(<MessageAnswer tree={null} />, {
      fetch: fakeApi({}),
    });

    expect(screen.getByText(catalogEn["assistant.empty_answer"])).toBeVisible();
  });

  it("draws the answer's Markdown", () => {
    renderWithProviders(
      <MessageAnswer tree={parseAnswer("Two **rides**.")} />,
      {
        fetch: fakeApi({}),
      },
    );

    expect(screen.getByText("rides")).toBeVisible();
    expect(
      screen.queryByText(catalogEn["assistant.empty_answer"]),
    ).not.toBeInTheDocument();
  });
});
