import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AssistantFile } from "@/features/assistant/api";
import { AssistantComposer } from "@/features/assistant/panel/assistant-composer";
import type { ComposerFiles } from "@/features/assistant/panel/use-composer-files";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const pdf: AssistantFile = {
  id: "f1",
  name: "nota.pdf",
  kind: "pdf",
  size: 2048,
  created_at: "2026-11-18T12:00:00Z",
};

const chat = {
  available: true,
  provider_name: "Gemini",
  model: "m",
  reads_files: false,
};

describe("AssistantComposer", () => {
  // FU3: send is refused while a file uploads; the text stays.
  it("refuses a send while a file uploads", async () => {
    const onSend = vi.fn();
    renderComposer(
      files({
        files: [{ key: "k", file: new File(["x"], "nota.pdf"), progress: 40 }],
        uploading: true,
      }),
      onSend,
      "Lê a nota",
    );

    await userEvent.type(screen.getByRole("textbox"), "{Enter}");

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText("nota")).toBeInTheDocument();
  });

  // F2, FU4: a stored file sends with no text, and the line states what the model reads.
  it("sends the stored files and states that this model reads no PDF", async () => {
    const onSend = vi.fn();
    const state = files({
      files: [
        {
          key: "k",
          file: new File(["x"], "nota.pdf"),
          progress: null,
          stored: pdf,
        },
      ],
      stored: [pdf],
    });
    renderComposer(state, onSend, "");

    expect(
      screen.getByText(
        "This model reads no PDF or image; it sees only the name.",
      ),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox"), "{Enter}");

    expect(onSend).toHaveBeenCalledWith("", [pdf]);
    expect(state.clear).toHaveBeenCalled();
  });

  // FU1: the attach button hands the chosen files to the list.
  it("adds the files chosen through the attach button", async () => {
    const state = files({});
    const { container } = renderComposer(state, vi.fn(), "");
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    const chosen = new File(["OFXHEADER:100"], "extrato.ofx");

    if (input === null) throw new Error("no file input");
    await userEvent.upload(input, chosen);

    expect(state.add).toHaveBeenCalledWith([chosen], []);
  });
});

function renderComposer(
  state: ComposerFiles,
  onSend: () => void,
  value: string,
) {
  return renderWithProviders(
    <AssistantComposer
      disabled={false}
      busy={false}
      chat={chat}
      files={state}
      onSend={onSend}
      onStop={vi.fn()}
      value={value}
      onValueChange={vi.fn()}
    />,
    { fetch: fakeApi({}) },
  );
}

function files(over: Partial<ComposerFiles>): ComposerFiles {
  return {
    files: [],
    stored: [],
    uploading: false,
    add: vi.fn(),
    drop: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
    ...over,
  };
}
