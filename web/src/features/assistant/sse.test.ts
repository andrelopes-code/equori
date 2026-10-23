import { describe, expect, it } from "vitest";

import { parseEvents } from "@/features/assistant/sse";

describe("parseEvents", () => {
  it("reads two events of one chunk", () => {
    const chunk =
      'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\n' +
      'event: step\ndata: {"tool":"list_accounts"}\n\n';
    expect(parseEvents(chunk, "")).toEqual({
      events: [
        { type: "turn", conversationId: "c1", messageId: "m1" },
        { type: "step", tool: "list_accounts" },
      ],
      carry: "",
    });
  });

  it("carries an event split across chunks", () => {
    const first = parseEvents('event: step\ndata: {"to', "");
    expect(first.events).toEqual([]);
    const second = parseEvents('ol":"get_help"}\n\n', first.carry);
    expect(second).toEqual({
      events: [{ type: "step", tool: "get_help" }],
      carry: "",
    });
  });

  it("keeps an escaped newline inside the JSON text", () => {
    const message = {
      id: "m2",
      role: "assistant",
      content: "a\nb",
      created_at: "2026-10-23T10:00:00Z",
      proposals: [],
    };
    const chunk = `event: answer\ndata: ${JSON.stringify(message)}\n\n`;
    expect(parseEvents(chunk, "").events).toEqual([
      { type: "answer", message },
    ]);
  });

  it("ignores an unknown event name", () => {
    const chunk =
      'event: ping\ndata: {}\n\nevent: step\ndata: {"tool":"x"}\n\n';
    expect(parseEvents(chunk, "").events).toEqual([
      { type: "step", tool: "x" },
    ]);
  });
});
