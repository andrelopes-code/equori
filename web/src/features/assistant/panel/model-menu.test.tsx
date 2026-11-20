import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantPanel } from "@/features/assistant/panel/assistant-panel";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithRouter } from "@/testing/render-app";
import { setViewport } from "@/testing/viewport";

const haiku = {
  provider_id: "p1",
  provider_name: "Anthropic",
  model: "claude-haiku-5-5",
  notice: "provider_terms",
  reads_files: true,
};
const local = {
  provider_id: "p2",
  provider_name: "Ollama",
  model: "qwen3:32b",
  notice: "local",
  reads_files: false,
};
const chat = {
  available: true,
  provider_name: "Anthropic",
  model: "claude-haiku-5-5",
  notice: "provider_terms",
  reads_files: true,
  targets: [haiku, local],
};

function setup(targets = chat.targets) {
  setViewport(1280);
  const posts: unknown[] = [];
  const fake = fakeApi({
    "GET /api/v1/assistant/chat": () => json(200, { ...chat, targets }),
    "GET /api/v1/assistant/conversations": () => json(200, { items: [] }),
    "POST /api/v1/assistant/turns": async (req) => {
      posts.push(await req.json());
      return new Response("", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    },
  });
  const absolute = ((input: RequestInfo | URL, init?: RequestInit) =>
    fake(
      typeof input === "string" ? `http://localhost${input}` : input,
      init,
    )) as typeof fetch;
  vi.stubGlobal("fetch", absolute);
  renderWithRouter(<AssistantPanel open onOpenChange={vi.fn()} />, {
    path: "/overview",
    fetch: absolute,
  });

  return posts;
}

async function send(text: string) {
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
  localStorage.clear();
});

describe("ModelMenu", () => {
  // MC6: one target leaves nothing to choose.
  it("is absent with fewer than two targets", async () => {
    setup([haiku]);
    const input = await screen.findByPlaceholderText(
      catalogEn["assistant.composer.placeholder"],
    );

    await waitFor(() => {
      expect(input).toBeEnabled();
    });

    expect(
      screen.queryByRole("button", { name: "Model: Automatic" }),
    ).not.toBeInTheDocument();
  });

  // MC2, MC5, MC7: the chosen model names the notice and travels with each turn.
  it("sends the chosen model and names its provider", async () => {
    const posts = setup();

    await userEvent.click(
      await screen.findByRole("button", { name: "Model: Automatic" }),
    );
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: /qwen3:32b/ }),
    );
    const notice = await screen.findByText(
      /Answers come from Ollama, model qwen3:32b\./,
    );
    const sentence = notice.textContent;
    await send("Hi");

    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(posts[0]).toMatchObject({
      text: "Hi",
      target: { provider_id: "p2", model: "qwen3:32b" },
    });
    expect(sentence).toContain(catalogEn["assistant.chat_notice.local"]);
    expect(
      screen.getByRole("button", { name: "Model: qwen3:32b" }),
    ).toBeInTheDocument();
  });

  // MC5: a stored model the chat no longer offers reads as no choice.
  it("sends no target for a model the chat lost", async () => {
    localStorage.setItem(
      "equori.assistant.target",
      JSON.stringify({ provider_id: "p9", model: "gone" }),
    );
    const posts = setup();

    await send("Hi");

    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(posts[0]).not.toHaveProperty("target");
  });
});
