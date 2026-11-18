import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AssistantFile } from "@/features/assistant/api";
import { UserMessage } from "@/features/assistant/message/user-message";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

function file(
  id: string,
  name: string,
  kind: AssistantFile["kind"],
): AssistantFile {
  return { id, name, kind, size: 1024, created_at: "2026-11-18T12:00:00Z" };
}

describe("UserMessage", () => {
  // FU5: a pdf opens in a new tab; a statement is named, not opened.
  it("shows the files sent above the text", () => {
    renderWithProviders(
      <UserMessage
        text="Lê a nota"
        files={[
          file("f1", "nota.pdf", "pdf"),
          file("f2", "extrato.ofx", "ofx"),
        ]}
      />,
      { fetch: fakeApi({}) },
    );

    const link = screen.getByRole("link", { name: /nota/ });

    expect(link).toHaveAttribute("href", "/api/v1/assistant/files/f1/content");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("link", { name: /extrato/ })).toBeNull();
    expect(screen.getByText("extrato")).toBeInTheDocument();
    expect(screen.getByText("Lê a nota")).toBeInTheDocument();
  });

  // F2: a message of files alone draws no bubble.
  it("draws no bubble for a message of files alone", () => {
    const { container } = renderWithProviders(
      <UserMessage text="" files={[file("f1", "recibo.jpg", "image")]} />,
      { fetch: fakeApi({}) },
    );

    expect(container.querySelector('[data-part="bubble"]')).toBeNull();
    expect(screen.getByRole("link", { name: /recibo/ })).toBeInTheDocument();
  });
});
