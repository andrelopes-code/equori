import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantPanel } from "@/features/assistant/assistant-panel";
import { maskAmountText } from "@/features/assistant/mask-amounts";
import { catalogEn } from "@/i18n/catalog.en";
import { writeLocale } from "@/i18n/locale";
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
    // A browser ends the body when the request's signal aborts.
    response: (signal?: AbortSignal) => {
      signal?.addEventListener("abort", () => {
        controller?.error(new DOMException("aborted", "AbortError"));
      });
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    },
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
  path = "/overview",
  width = 1280,
) {
  setViewport(width);
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
  const onOpenChange = vi.fn();
  const { router } = renderWithRouter(
    <AssistantPanel open onOpenChange={onOpenChange} />,
    { path, fetch: absolute },
  );
  const navigate = vi.spyOn(router, "navigate").mockResolvedValue(undefined);
  return { navigate, onOpenChange };
}

// A conversation whose answer to "How much?" ended with outcome.
function unanswered(outcome: "failed" | "canceled") {
  const d = detail("");
  return {
    ...d,
    messages: [d.messages[0], { ...message(""), outcome }],
  };
}

// Asks "How much?" in conversation c1, whose turn ends with an assistant_failed event; later
// POSTs answer with the streams of more, and posts collects every request body.
async function failedTurn(
  outcome: "failed" | "canceled",
  more: ReturnType<typeof turnStream>[] = [],
) {
  const posts: unknown[] = [];
  const first = turnStream();
  const streams = [first, ...more];
  setup({
    "POST /api/v1/assistant/turns": async (req) => {
      posts.push(await req.json());
      const next = streams.shift();
      if (next === undefined) throw new Error("no stream left");
      return next.response();
    },
    "GET /api/v1/assistant/conversations/c1": () =>
      json(200, unanswered(outcome)),
  });
  await ask("How much?");
  act(() => {
    first.write(
      'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: error\ndata: {"status":502,"code":"assistant_failed"}\n\n',
    );
    first.close();
  });
  return posts;
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
  sessionStorage.clear();
});

describe("AssistantPanel", () => {
  it("names the provider and the training notice before the first message", async () => {
    setup({});
    const notice = await screen.findByText(
      /Answers come from Gemini, model flash-lite\./,
    );
    expect(notice.textContent).toContain(
      catalogEn["assistant.chat_notice.trains"],
    );
  });

  it("focuses the composer on open (U7, P18)", async () => {
    setup({});
    const input = await screen.findByPlaceholderText(
      catalogEn["assistant.composer.placeholder"],
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it("leaves the composer unfocused when the sheet opens on a phone", async () => {
    setup({}, "/overview", 390);
    const input = await screen.findByPlaceholderText(
      catalogEn["assistant.composer.placeholder"],
    );
    await waitFor(() => {
      expect(input.hasAttribute("disabled")).toBe(false);
    });
    expect(document.activeElement).not.toBe(input);
  });

  it("reopens the last conversation after a reload (U12)", async () => {
    sessionStorage.setItem("equori.assistant.conversation", "c1");
    setup({
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, detail("You spent **10 items**.")),
    });
    expect(await screen.findByText("10 items")).toBeInTheDocument();
  });

  it("starts a new conversation after New conversation", async () => {
    sessionStorage.setItem("equori.assistant.conversation", "c1");
    setup({
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, detail("You spent **10 items**.")),
    });
    await screen.findByText("10 items");
    await userEvent.click(
      screen.getByRole("button", {
        name: catalogEn["assistant.new_conversation"],
      }),
    );
    expect(
      await screen.findByText(catalogEn["assistant.welcome.title"]),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("equori.assistant.conversation")).toBeNull();
  });

  // Review Focus 4: a stored conversation the server no longer has opens a new one.
  it("starts a new conversation when the stored one is gone", async () => {
    sessionStorage.setItem("equori.assistant.conversation", "c9");
    setup({
      "GET /api/v1/assistant/conversations/c9": () =>
        problem(404, "conversation_not_found"),
    });
    expect(
      await screen.findByText(catalogEn["assistant.welcome.title"]),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        sessionStorage.getItem("equori.assistant.conversation"),
      ).toBeNull();
    });
  });

  // A message typed while the history was open went to no visible conversation; the history now
  // holds no composer, and leaving it brings the composer back.
  it("hides the composer while the conversation history is open", async () => {
    setup({
      "GET /api/v1/assistant/conversations": () => json(200, { items: [] }),
    });
    const placeholder = catalogEn["assistant.composer.placeholder"];
    expect(await screen.findByPlaceholderText(placeholder)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["assistant.history"] }),
    );
    expect(
      await screen.findByText(catalogEn["assistant.conversations.empty"]),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(placeholder)).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["assistant.back"] }),
    );
    expect(await screen.findByPlaceholderText(placeholder)).toBeInTheDocument();
  });

  it("disables the composer and says when the assistant returns", async () => {
    setup({
      "GET /api/v1/assistant/chat": () =>
        json(200, { available: false, retry_at: "2026-10-24T00:00:00Z" }),
    });
    expect(
      await screen.findByText(/^The assistant returns at /),
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
    // P5: after the answer the steps fold into one closed line.
    expect(
      await screen.findByRole("button", { name: /Sources consulted: 1/ }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("never shows the welcome between the first turn event and the answer (U1)", async () => {
    const stream = turnStream();
    let resolveRoute: (r: Response) => void = () => undefined;
    setup({
      "POST /api/v1/assistant/turns": () => stream.response(),
      "GET /api/v1/assistant/conversations/c1": () =>
        new Promise<Response>((resolve) => {
          resolveRoute = resolve;
        }),
    });
    await ask("How much?");
    const welcome = catalogEn["assistant.welcome.title"];
    let welcomed = false;
    const observer = new MutationObserver(() => {
      if (document.body.textContent.includes(welcome)) welcomed = true;
    });
    act(() => {
      stream.write(
        'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\n',
      );
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    act(() => {
      stream.write(
        `event: answer\ndata: ${JSON.stringify(message("You spent **10 items**."))}\n\n`,
      );
      stream.close();
    });
    expect(await screen.findByText("10 items")).toBeInTheDocument();
    expect(screen.queryByText(welcome)).toBeNull();
    observer.disconnect();
    expect(welcomed).toBe(false);
    resolveRoute(json(200, detail("You spent **10 items**.")));
  });

  // The close is the last button of the header's actions, drawn at their size and on their row.
  it.each([1280, 390])(
    "closes the drawer at %i px through the last of its header actions",
    async (width) => {
      const { onOpenChange } = setup({}, "/overview", width);
      const header = await screen.findByText(catalogEn["assistant.title"]);
      const drawer = header.closest<HTMLElement>('[data-ui="drawer"]');
      if (drawer === null) throw new Error("no drawer");

      const close = within(drawer).getByRole("button", {
        name: catalogEn["detail.close"],
      });
      await userEvent.click(close);

      const actions = close.closest<HTMLElement>('[data-part="actions"]');
      expect(actions).not.toBeNull();
      expect(
        within(actions ?? drawer)
          .getAllByRole("button")
          .at(-1),
      ).toBe(close);
      expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    },
  );

  it("names the conversation after the question while the first turn runs (U13)", async () => {
    const stream = turnStream();
    setup({ "POST /api/v1/assistant/turns": () => stream.response() });
    await ask("How much?");
    act(() => {
      stream.write(
        'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\n',
      );
    });
    const header = await screen.findByText(catalogEn["assistant.title"]);
    const drawer = header.closest('[data-ui="drawer"]') ?? document.body;
    await waitFor(() => {
      expect(
        within(drawer as HTMLElement).queryByText(
          catalogEn["assistant.new_conversation"],
        ),
      ).toBeNull();
    });
    expect(
      within(drawer as HTMLElement).getAllByText("How much?").length,
    ).toBeGreaterThan(1);
  });

  it("offers a retry on a failed answer that sends the same text (U5, P6)", async () => {
    const posts = await failedTurn("failed", [turnStream()]);
    expect(
      await screen.findByText(catalogEn["assistant.no_answer"]),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["assistant.retry"] }),
    );
    await waitFor(() => {
      expect(posts).toHaveLength(2);
    });
    expect(posts[1]).toMatchObject({
      conversation_id: "c1",
      text: "How much?",
    });
  });

  it("shows the stop on a canceled answer", async () => {
    await failedTurn("canceled");
    expect(
      await screen.findByText(catalogEn["assistant.canceled"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: catalogEn["assistant.retry"] }),
    ).toBeInTheDocument();
  });

  it("does not block after a failed turn event", async () => {
    await failedTurn("failed");
    expect(
      await screen.findByText(catalogEn["assistant.no_answer"]),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(catalogEn["assistant.composer.placeholder"]),
    ).toBeEnabled();
    expect(
      screen.queryByText(catalogEn["assistant.exhausted.title"]),
    ).toBeNull();
    expect(document.querySelector('[data-tone="danger"]')).toBeNull();
  });

  // Review Focus 5: a retry while a turn runs is refused like any send during a turn.
  it("sends nothing on a retry while a turn runs", async () => {
    const running = turnStream();
    const posts = await failedTurn("failed", [running]);
    expect(
      await screen.findByText(catalogEn["assistant.no_answer"]),
    ).toBeInTheDocument();
    await ask("Again?");
    await waitFor(() => {
      expect(posts).toHaveLength(2);
    });
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["assistant.retry"] }),
    );
    expect(posts).toHaveLength(2);
    running.close();
  });

  it("re-enables the composer when retry_at passes (U4, P7)", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "Date"],
      shouldAdvanceTime: true,
    });
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));
    let calls = 0;
    try {
      setup({
        "GET /api/v1/assistant/chat": () =>
          calls++ === 0
            ? json(200, { available: false, retry_at: "2026-10-23T10:01:00Z" })
            : json(200, chat),
      });
      const input = await screen.findByPlaceholderText(
        catalogEn["assistant.composer.placeholder"],
      );
      await screen.findByText(/^The assistant returns at /);
      expect(input).toBeDisabled();
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      await waitFor(() => {
        expect(input).toBeEnabled();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers no retry while the chat is blocked", async () => {
    sessionStorage.setItem("equori.assistant.conversation", "c1");
    setup({
      "GET /api/v1/assistant/chat": () =>
        json(200, { available: false, retry_at: "2099-01-01T00:00:00Z" }),
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, unanswered("failed")),
    });
    expect(
      await screen.findByText(catalogEn["assistant.no_answer"]),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: catalogEn["assistant.retry"] }),
    ).toBeNull();
  });

  // The turn failed after the stream started and no failed answer was stored.
  it("offers a retry on a question left without an answer", async () => {
    sessionStorage.setItem("equori.assistant.conversation", "c1");
    const d = detail("");
    setup({
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, { ...d, messages: [d.messages[0]] }),
    });
    expect(
      await screen.findByText(catalogEn["assistant.no_answer"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: catalogEn["assistant.retry"] }),
    ).toBeInTheDocument();
  });

  // A client clock ahead of the server's sees retry_at pass while the server still blocks.
  it("keeps asking for the chat state while a passed retry_at still blocks", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "Date"],
      shouldAdvanceTime: true,
    });
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));
    let calls = 0;
    try {
      setup({
        "GET /api/v1/assistant/chat": () =>
          calls++ < 2
            ? json(200, { available: false, retry_at: "2026-10-23T09:59:00Z" })
            : json(200, chat),
      });
      const input = await screen.findByPlaceholderText(
        catalogEn["assistant.composer.placeholder"],
      );
      await waitFor(() => {
        expect(calls).toBe(2);
      });
      expect(input).toBeDisabled();
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      await waitFor(() => {
        expect(input).toBeEnabled();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("links the settings when no provider serves the assistant (U14, P8)", async () => {
    const { navigate, onOpenChange } = setup({
      "GET /api/v1/assistant/chat": () => json(200, { available: false }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["assistant.setup"],
      }),
    );
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/settings",
        search: { section: "assistant" },
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.querySelector('[data-tone="danger"]')).toBeNull();
  });

  // P7: the notice reads the chat state, which the refetch after the refused turn brings.
  it("shows the answer while it streams (G2)", async () => {
    const stream = turnStream();
    setup({ "POST /api/v1/assistant/turns": () => stream.response() });
    await ask("How much?");
    act(() => {
      stream.write(
        'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: delta\ndata: {"text":"You spent "}\n\nevent: delta\ndata: {"text":"**10 items**"}\n\n',
      );
    });
    const strong = await screen.findByText("10 items");
    expect(strong.closest("strong")).not.toBeNull();
    stream.close();
  });

  it("drops the text of a step", async () => {
    const stream = turnStream();
    setup({ "POST /api/v1/assistant/turns": () => stream.response() });
    await ask("How much?");
    act(() => {
      stream.write(
        'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: delta\ndata: {"text":"Let me check"}\n\n',
      );
    });
    expect(await screen.findByText("Let me check")).toBeInTheDocument();
    act(() => {
      stream.write('event: step\ndata: {"tool":"search_transactions"}\n\n');
    });
    expect(
      await screen.findByText("Searching transactions"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Let me check")).toBeNull();
    stream.close();
  });

  it("stops a running turn (P3)", async () => {
    const stream = turnStream();
    let signal: AbortSignal | undefined;
    setup({
      "POST /api/v1/assistant/turns": (req) => {
        signal = req.signal;
        return stream.response(req.signal);
      },
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, unanswered("canceled")),
    });
    await ask("How much?");
    act(() => {
      stream.write(
        'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\n',
      );
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["assistant.composer.stop"],
      }),
    );
    expect(signal?.aborted).toBe(true);
    const thread = document.querySelector<HTMLElement>(
      '[data-own="assistant-panel"]',
    );
    if (thread === null) throw new Error("the panel is not rendered");
    expect(
      await within(thread).findByText(catalogEn["assistant.canceled"]),
    ).toBeInTheDocument();
  });

  // Review of phase 2: the refetch after Stop can arrive before the server stores the canceled
  // answer; the question still shows the stop.
  it("shows the stop when the refetch precedes the stored stop", async () => {
    const stream = turnStream();
    const d = detail("");
    setup({
      "POST /api/v1/assistant/turns": (req) => stream.response(req.signal),
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, { ...d, messages: [d.messages[0]] }),
    });
    await ask("How much?");
    act(() => {
      stream.write(
        'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\n',
      );
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["assistant.composer.stop"],
      }),
    );
    const thread = document.querySelector<HTMLElement>(
      '[data-own="assistant-panel"]',
    );
    if (thread === null) throw new Error("the panel is not rendered");
    expect(
      await within(thread).findByRole("button", {
        name: catalogEn["assistant.retry"],
      }),
    ).toBeInTheDocument();
    expect(
      within(thread).getByText(catalogEn["assistant.canceled"]),
    ).toBeInTheDocument();
    expect(
      within(thread).queryByText(catalogEn["assistant.no_answer"]),
    ).toBeNull();
  });

  it("keeps the text of the field on Enter during a turn (P4)", async () => {
    const stream = turnStream();
    let posts = 0;
    setup({
      "POST /api/v1/assistant/turns": () => {
        posts++;
        return stream.response();
      },
    });
    await ask("How much?");
    act(() => {
      stream.write(
        'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\n',
      );
    });
    const input = screen.getByPlaceholderText(
      catalogEn["assistant.composer.placeholder"],
    );
    await userEvent.type(input, "next{Enter}");
    expect(input).toHaveValue("next");
    expect(posts).toBe(1);
    expect(
      screen.getByRole("button", {
        name: catalogEn["assistant.composer.stop"],
      }),
    ).toBeInTheDocument();
    stream.close();
  });

  // Review Focus 4 of phase 2: once the answer event arrives the turn is over for the reader; the
  // stop control is gone and the answer stays.
  it("keeps the answer that arrived before the stream closed", async () => {
    const stream = turnStream();
    setup({
      "POST /api/v1/assistant/turns": () => stream.response(),
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, detail("You spent **10 items**.")),
    });
    await ask("How much?");
    act(() => {
      stream.write(
        `event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: answer\ndata: ${JSON.stringify(message("You spent **10 items**."))}\n\n`,
      );
    });
    expect(await screen.findByText("10 items")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: catalogEn["assistant.composer.stop"],
      }),
    ).toBeNull();
    stream.close();
    expect(await screen.findByText("10 items")).toBeInTheDocument();
  });

  it("lists every step of the turn (U16)", async () => {
    const stream = turnStream();
    setup({ "POST /api/v1/assistant/turns": () => stream.response() });
    await ask("How much?");
    act(() => {
      stream.write(
        'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: step\ndata: {"tool":"search_transactions"}\n\nevent: step\ndata: {"tool":"get_balances"}\n\n',
      );
    });
    const first = await screen.findByText("Searching transactions");
    const second = await screen.findByText(
      catalogEn["assistant.step.get_balances"],
    );
    expect(first.closest('[data-part="activity-step"]')).toHaveAttribute(
      "data-complete",
    );
    expect(second.closest('[data-part="activity-step"]')).toHaveAttribute(
      "aria-current",
      "step",
    );
    stream.close();
  });

  it("collapses the steps after the answer", async () => {
    const stream = turnStream();
    setup({
      "POST /api/v1/assistant/turns": () => stream.response(),
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, detail("You spent **10 items**.")),
    });
    await ask("How much?");
    act(() => {
      stream.write(
        `event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: step\ndata: {"tool":"search_transactions"}\n\nevent: step\ndata: {"tool":"get_balances"}\n\nevent: answer\ndata: ${JSON.stringify(message("You spent **10 items**."))}\n\n`,
      );
      stream.close();
    });
    const summary = await screen.findByRole("button", {
      name: /Sources consulted: 2/,
    });
    expect(summary).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(summary);
    expect(summary).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Searching transactions")).toBeVisible();
    expect(
      screen.getByText(catalogEn["assistant.step.get_balances"]),
    ).toBeVisible();
  });

  it("links the MCP settings when no provider serves the assistant (P8)", async () => {
    const { navigate, onOpenChange } = setup({
      "GET /api/v1/assistant/chat": () => json(200, { available: false }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["assistant.use_mcp"],
      }),
    );
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/settings",
        search: { section: "external_access" },
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // P13, U10: an answer with proposals brings the last card's actions into view.
  it("scrolls the actions of the last card into view (U10)", async () => {
    const scrolled: Element[] = [];
    const original = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "scrollIntoView",
    );
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value(this: Element) {
        scrolled.push(this);
      },
    });
    try {
      const proposal = (id: string) => ({
        id,
        tool: "record_transaction",
        status: "pending",
        preview: { action: "record_transaction", changes: [] },
        created_at: "2026-10-23T10:00:00Z",
        expires_at: "2099-10-23T10:15:00Z",
      });
      const withCards = {
        ...message("Two changes."),
        proposals: [proposal("p1"), proposal("p2")],
      };
      const stream = turnStream();
      setup({
        "POST /api/v1/assistant/turns": () => stream.response(),
        "GET /api/v1/assistant/conversations/c1": () =>
          json(200, {
            ...detail(""),
            messages: [detail("").messages[0], withCards],
          }),
      });
      await ask("How much?");
      act(() => {
        stream.write(
          `event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: answer\ndata: ${JSON.stringify(withCards)}\n\n`,
        );
        stream.close();
      });
      const confirms = await screen.findAllByRole("button", {
        name: catalogEn["assistant.proposal.confirm"],
      });
      const last = confirms.at(-1);
      await waitFor(() => {
        expect(
          scrolled.some((el) => last !== undefined && el.contains(last)),
        ).toBe(true);
      });
    } finally {
      if (original === undefined)
        Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      else Object.defineProperty(Element.prototype, "scrollIntoView", original);
    }
  });

  // P20: the welcome suggests questions about the current screen.
  it("suggests questions about the transactions screen", async () => {
    setup({}, "/transactions");
    for (const n of ["1", "2", "3"] as const) {
      expect(
        await screen.findByRole("button", {
          name: catalogEn[`assistant.suggestion.transactions.${n}`],
        }),
      ).toBeInTheDocument();
    }
  });

  // P21 and Review Focus 5 of phase 4: copying gives the answer's Markdown, masked while privacy is on.
  it.each([false, true])(
    "copies the answer's Markdown (privacy %s)",
    async (masked) => {
      const written: string[] = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (text: string) => {
            written.push(text);
            return Promise.resolve();
          },
        },
      });
      await answer("Gastou R$ 1.234,56 em **outubro**", masked);
      await screen.findByText("outubro");
      await userEvent.click(
        screen.getByRole("button", { name: catalogEn["assistant.copy"] }),
      );
      await waitFor(() => {
        expect(written).toHaveLength(1);
      });
      expect(written[0]).toBe(
        masked
          ? maskAmountText("Gastou R$ 1.234,56 em **outubro**")
          : "Gastou R$ 1.234,56 em **outubro**",
      );
    },
  );

  it("says when the quota returns after an exhausted error event", async () => {
    let refused = false;
    setup({
      "GET /api/v1/assistant/chat": () =>
        json(
          200,
          refused
            ? { available: false, retry_at: "2026-10-24T00:00:00Z" }
            : chat,
        ),
      "POST /api/v1/assistant/turns": () => {
        refused = true;
        return problem(429, "assistant_exhausted", {
          retry_at: "2026-10-24T00:00:00Z",
        });
      },
    });
    await ask("Hello");
    expect(
      await screen.findByText(/^The assistant returns at /),
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

  // Language en, region DE, amounts in EUR as the model writes them for de-DE.
  const table = [
    "Spending by month:",
    "",
    "| Category | October | November |",
    "| :--- | ---: | ---: |",
    "| Food | 1.234,56 € | 98,50 € |",
    "| Rent | 900,00 € | 900,00 € |",
    "| Car | 60,00 € | 75,10 € |",
  ].join("\n");

  async function answer(content: string, hidden = false) {
    localStorage.clear();
    if (hidden) hideAmounts();
    writeLocale({ language: "en", region: "DE" });
    const stream = turnStream();
    setup({
      "POST /api/v1/assistant/turns": () => stream.response(),
      "GET /api/v1/assistant/conversations/c1": () =>
        json(200, detail(content)),
    });
    await ask("How much?");
    act(() => {
      stream.write(
        `event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: answer\ndata: ${JSON.stringify(message(content))}\n\n`,
      );
      stream.close();
    });
  }

  it("renders a table of an answer with column headers", async () => {
    await answer(table);
    const grid = await screen.findByRole("table");
    const headers = within(grid).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual([
      "Category",
      "October",
      "November",
    ]);
    for (const h of headers) expect(h).toHaveAttribute("scope", "col");
    expect(within(grid).getAllByRole("row")).toHaveLength(4);
    expect(within(grid).getByText("1.234,56 €")).toBeInTheDocument();
  });

  // P10, P11: an answer spans the thread without a bubble; columns of amounts align to the end.
  it("renders an answer across the thread with amounts aligned to the end", async () => {
    await answer(table);
    const grid = await screen.findByRole("table");
    expect(grid.closest('[data-part="bubble"]')).toBeNull();
    expect(within(grid).getByText("1.234,56 €")).toHaveAttribute(
      "data-align",
      "end",
    );
    const question = screen
      .getAllByText("How much?")
      .find((el) => el.closest('[data-part="bubble"]') !== null);
    expect(question).toBeDefined();
  });

  it("masks the amounts in the cells of a table while privacy is on", async () => {
    await answer(table, true);
    const grid = await screen.findByRole("table");
    expect(within(grid).getByText("Food")).toBeInTheDocument();
    expectNoAmounts(grid, ["1.234,56", "98,50", "900,00", "60,00", "75,10"]);
  });

  it("shows a malformed table as text", async () => {
    await answer("| Category | October |\n| Food | 98,50 € |");
    expect(
      await screen.findByText(/\| Food \| 98,50 € \|/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
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
