import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantPanel } from "@/features/assistant/assistant-panel";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderWithRouter } from "@/testing/render-app";
import { setViewport } from "@/testing/viewport";

const chat = {
  available: true,
  provider_name: "Gemini",
  model: "flash-lite",
  notice: "trains",
};

function message(content: string) {
  return {
    id: "m2",
    role: "assistant",
    content,
    created_at: "2026-10-23T10:00:01Z",
    proposals: [],
  };
}

function detail(content: string) {
  return {
    id: "c1",
    title: "Question",
    created_at: "2026-10-23T10:00:00Z",
    updated_at: "2026-10-23T10:00:01Z",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "How much?",
        created_at: "2026-10-23T10:00:00Z",
        proposals: [],
      },
      message(content),
    ],
  };
}

// The turn is a stream the test writes to by hand.
function turnStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: () =>
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    write: (frame: string) => {
      controller?.enqueue(encoder.encode(frame));
    },
    close: () => {
      controller?.close();
    },
  };
}

function setup(
  routes: Record<string, (req: Request) => Response | Promise<Response>>,
) {
  setViewport(1280);
  const fake = fakeApi({
    "GET /api/v1/assistant/chat": () => json(200, chat),
    "GET /api/v1/assistant/conversations": () => json(200, { items: [] }),
    ...routes,
  });
  const absolute = ((input: RequestInfo | URL, init?: RequestInit) =>
    fake(
      typeof input === "string" ? `http://localhost${input}` : input,
      init,
    )) as typeof fetch;
  vi.stubGlobal("fetch", absolute);
  const { router } = renderWithRouter(
    <AssistantPanel open onOpenChange={vi.fn()} />,
    { path: "/overview", fetch: absolute },
  );
  const navigate = vi.spyOn(router, "navigate").mockResolvedValue(undefined);
  return { navigate };
}

async function ask(text: string) {
  const input = await screen.findByPlaceholderText(
    catalogEn["assistant.composer.placeholder"],
  );
  await waitFor(() => {
    expect(input).toBeEnabled();
  });
  await userEvent.type(input, text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AssistantPanel", () => {
  it("names the provider and the training notice before the first message", async () => {
    setup({});
    expect(
      await screen.findByText("Answers come from Gemini, model flash-lite."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["assistant.chat_notice.trains"]),
    ).toBeInTheDocument();
  });

  it("disables the composer and says when the assistant returns", async () => {
    setup({
      "GET /api/v1/assistant/chat": () =>
        json(200, { available: false, retry_at: "2026-10-24T00:00:00Z" }),
    });
    expect(
      await screen.findByText(
        /The daily quota is used up\. The assistant returns at /,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(catalogEn["assistant.composer.placeholder"]),
    ).toBeDisabled();
  });

  it("shows the step line, then the answer", async () => {
    const stream = turnStream();
    setup({
      "POST /api/v1/assistant/turns": () => stream.response(),
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, detail("You spent **10 items**.")),
    });
    await ask("How much?");
    act(() => {
      stream.write(
        'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: step\ndata: {"tool":"search_transactions"}\n\n',
      );
    });
    expect(
      await screen.findByText("Searching transactions"),
    ).toBeInTheDocument();
    act(() => {
      stream.write(
        `event: answer\ndata: ${JSON.stringify(message("You spent **10 items**."))}\n\n`,
      );
      stream.close();
    });
    expect(await screen.findByText("10 items")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Searching transactions")).toBeNull();
    });
  });

  it("says when the quota returns after an exhausted error event", async () => {
    setup({
      "POST /api/v1/assistant/turns": () =>
        problem(429, "assistant_exhausted", {
          retry_at: "2026-10-24T00:00:00Z",
        }),
    });
    await ask("Hello");
    expect(
      await screen.findByText(
        /The daily quota is used up\. The assistant returns at /,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(catalogEn["assistant.composer.placeholder"]),
    ).toBeDisabled();
  });

  it("masks an amount of an answer while privacy is on", async () => {
    hideAmounts();
    const stream = turnStream();
    setup({
      "POST /api/v1/assistant/turns": () => stream.response(),
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, detail("Gastou R$ 1.234,56 em outubro")),
    });
    await ask("How much?");
    act(() => {
      stream.write(
        `event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: answer\ndata: ${JSON.stringify(message("Gastou R$ 1.234,56 em outubro"))}\n\n`,
      );
      stream.close();
    });
    expect(await screen.findByText(/em outubro/)).toBeInTheDocument();
    const panel = document.querySelector<HTMLElement>(
      '[data-own="assistant-panel"]',
    );
    if (panel === null) throw new Error("the panel is not rendered");
    expectNoAmounts(panel, ["1.234,56"]);
  });

  it("navigates through the router on a link to a screen", async () => {
    const stream = turnStream();
    const { navigate } = setup({
      "POST /api/v1/assistant/turns": () => stream.response(),
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, detail("See [Cards](/cards) and [Nope](/nope).")),
    });
    await ask("Where?");
    act(() => {
      stream.write(
        `event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: answer\ndata: ${JSON.stringify(message("See [Cards](/cards) and [Nope](/nope)."))}\n\n`,
      );
      stream.close();
    });
    await userEvent.click(await screen.findByRole("link", { name: "Cards" }));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/cards" }),
    );
    expect(screen.queryByRole("link", { name: "Nope" })).toBeNull();
  });
});
