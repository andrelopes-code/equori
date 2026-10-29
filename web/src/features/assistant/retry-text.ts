import type { AssistantMessage } from "@/features/assistant/sse";

// The question a retry sends again: an unanswered question, or the one before a failed or
// stopped answer. A blocked chat offers no retry.
export function retryText(
  messages: readonly AssistantMessage[],
  { blocked, orphan }: { blocked: boolean; orphan: boolean },
): string | undefined {
  if (blocked) return undefined;

  const last = messages.at(-1);
  if (orphan) return last?.content;

  if (last?.outcome === "failed" || last?.outcome === "canceled") {
    return messages.at(-2)?.content;
  }

  return undefined;
}
