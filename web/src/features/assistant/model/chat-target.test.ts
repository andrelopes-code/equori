import { afterEach, describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  chatWithTarget,
  chosenTarget,
  readStoredChoice,
  subscribeStoredChoice,
  writeStoredChoice,
} from "@/features/assistant/model/chat-target";

type Chat = components["schemas"]["AssistantChat"];

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
const chat: Chat = {
  available: true,
  provider_name: "Anthropic",
  model: "claude-haiku-5-5",
  notice: "provider_terms",
  reads_files: true,
  targets: [haiku, local],
};

describe("chosenTarget", () => {
  it.each([
    [
      "no chat",
      undefined,
      JSON.stringify({ provider_id: "p2", model: "qwen3:32b" }),
      undefined,
    ],
    ["no choice", chat, null, undefined],
    [
      "a target of the chat",
      chat,
      JSON.stringify({ provider_id: "p2", model: "qwen3:32b" }),
      local,
    ],
    [
      "a target the chat lost",
      chat,
      JSON.stringify({ provider_id: "p3", model: "x" }),
      undefined,
    ],
    ["a value that is not JSON", chat, "qwen3", undefined],
    [
      "JSON of another shape",
      chat,
      JSON.stringify(["p2", "qwen3:32b"]),
      undefined,
    ],
  ])("%s", (_, c, stored, want) => {
    expect(chosenTarget(c, stored)).toEqual(want);
  });
});

describe("chatWithTarget", () => {
  it("presents the chosen target", () => {
    expect(chatWithTarget(chat, local)).toEqual({
      ...chat,
      provider_name: "Ollama",
      model: "qwen3:32b",
      notice: "local",
      reads_files: false,
    });
  });

  it("keeps the chat without a choice", () => {
    expect(chatWithTarget(chat, undefined)).toBe(chat);
  });
});

describe("stored choice", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("writes, notifies and removes the choice", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeStoredChoice(listener);

    writeStoredChoice({ provider_id: "p2", model: "qwen3:32b" });
    const written = readStoredChoice();
    writeStoredChoice(null);
    unsubscribe();
    writeStoredChoice({ provider_id: "p1", model: "claude-haiku-5-5" });

    expect(written).toBe(
      JSON.stringify({ provider_id: "p2", model: "qwen3:32b" }),
    );
    expect(readStoredChoice()).toBe(
      JSON.stringify({ provider_id: "p1", model: "claude-haiku-5-5" }),
    );
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
