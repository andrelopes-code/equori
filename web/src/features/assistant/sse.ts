import type { components } from "@/api/schema.gen";

export type AssistantMessage = components["schemas"]["AssistantMessage"];
export type AssistantProblem = components["schemas"]["Problem"];

export type AssistantEvent =
  | { type: "turn"; conversationId: string; messageId: string }
  | { type: "step"; tool: string }
  | { type: "answer"; message: AssistantMessage }
  | { type: "error"; problem: AssistantProblem };

function toEvent(name: string, data: string): AssistantEvent | undefined {
  const body = JSON.parse(data) as Record<string, unknown>;
  switch (name) {
    case "turn":
      return {
        type: "turn",
        conversationId: body.conversation_id as string,
        messageId: body.message_id as string,
      };
    case "step":
      return { type: "step", tool: body.tool as string };
    case "answer":
      return { type: "answer", message: body as unknown as AssistantMessage };
    case "error":
      return { type: "error", problem: body as unknown as AssistantProblem };
    default:
      return undefined;
  }
}

// Frames end at a blank line; the unfinished tail returns as `carry` for the next chunk.
export function parseEvents(
  chunk: string,
  carry: string,
): { events: AssistantEvent[]; carry: string } {
  const frames = (carry + chunk).replace(/\r\n/g, "\n").split("\n\n");
  const rest = frames.pop() ?? "";
  const events: AssistantEvent[] = [];
  for (const frame of frames) {
    let name = "";
    const data: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) name = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (data.length === 0) continue;
    const event = toEvent(name, data.join("\n"));
    if (event !== undefined) events.push(event);
  }
  return { events, carry: rest };
}
