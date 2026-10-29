import { describe, expect, it } from "vitest";

import { retryText } from "@/features/assistant/retry-text";
import type { AssistantMessage } from "@/features/assistant/sse";

function message(
  role: AssistantMessage["role"],
  content: string,
  outcome?: AssistantMessage["outcome"],
): AssistantMessage {
  return {
    id: content,
    role,
    content,
    created_at: "2026-10-29T10:00:00Z",
    proposals: [],
    ...(outcome === undefined ? {} : { outcome }),
  };
}

describe("retryText", () => {
  const question = message("user", "How much did I spend?");

  it.each([
    ["an unanswered question", [question], true, "How much did I spend?"],
    [
      "a failed answer",
      [question, message("assistant", "", "failed")],
      false,
      "How much did I spend?",
    ],
    [
      "a stopped answer",
      [question, message("assistant", "", "canceled")],
      false,
      "How much did I spend?",
    ],
    [
      "a complete answer",
      [question, message("assistant", "Ten.")],
      false,
      undefined,
    ],
    ["an empty conversation", [], false, undefined],
  ])("retries %s", (_, messages, orphan, expected) => {
    expect(retryText(messages, { blocked: false, orphan })).toBe(expected);
  });

  it("offers no retry when the chat is blocked", () => {
    const messages = [question, message("assistant", "", "failed")];

    expect(
      retryText(messages, { blocked: true, orphan: false }),
    ).toBeUndefined();
  });
});
