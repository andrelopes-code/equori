import { describe, expect, it, vi } from "vitest";

import { sendMessage } from "@/features/assistant/api";
import type { AssistantEvent } from "@/features/assistant/sse";
import { problem } from "@/testing/fake-api";

function stream(...frames: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );
}

async function run(response: Response) {
  const fetchImpl = vi.fn(() => Promise.resolve(response));
  const events: AssistantEvent[] = [];
  await sendMessage(
    { text: "hi", page: "/cards" },
    (e) => events.push(e),
    new AbortController().signal,
    fetchImpl,
  );
  return { events, fetchImpl };
}

describe("sendMessage", () => {
  it("delivers a 429 problem as one error event", async () => {
    const { events, fetchImpl } = await run(
      problem(429, "assistant_exhausted", { retry_at: "2026-10-24T00:00:00Z" }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "error",
      problem: {
        code: "assistant_exhausted",
        retry_at: "2026-10-24T00:00:00Z",
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/assistant/turns",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "hi", page: "/cards" }),
      }),
    );
  });

  it("delivers turn, step and answer in order", async () => {
    const message = {
      id: "m2",
      role: "assistant",
      content: "ok",
      created_at: "2026-10-23T10:00:00Z",
      proposals: [],
    };
    const { events } = await run(
      stream(
        'event: turn\ndata: {"conversation_id":"c1","message_id":"m1"}\n\nevent: st',
        'ep\ndata: {"tool":"get_balances"}\n\n',
        `event: answer\ndata: ${JSON.stringify(message)}\n\n`,
      ),
    );
    expect(events.map((e) => e.type)).toEqual(["turn", "step", "answer"]);
  });
});
