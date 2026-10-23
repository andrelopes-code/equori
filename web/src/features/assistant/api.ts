import { queryOptions, useMutation } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { parseProblem, unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";
import { parseEvents } from "@/features/assistant/sse";
import type { AssistantEvent } from "@/features/assistant/sse";

export const assistantKeys = {
  all: ["assistant"] as const,
  chat: () => [...assistantKeys.all, "chat"] as const,
  conversations: () => [...assistantKeys.all, "conversations"] as const,
  conversation: (id: string) =>
    [...assistantKeys.all, "conversation", id] as const,
};

export function chatStateQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: assistantKeys.chat(),
    queryFn: async () => unwrap(await api.GET("/assistant/chat")),
  });
}

export function conversationsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: assistantKeys.conversations(),
    queryFn: async () => {
      const page = await unwrap(
        await api.GET("/assistant/conversations", {
          params: { query: { limit: 100 } },
        }),
      );
      return page.items;
    },
  });
}

export function conversationQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: assistantKeys.conversation(id),
    queryFn: async () =>
      unwrap(
        await api.GET("/assistant/conversations/{id}", {
          params: { path: { id } },
        }),
      ),
  });
}

export async function confirmProposal(api: Client<paths>, id: string) {
  return unwrap(
    await api.POST("/assistant/proposals/{id}/confirm", {
      params: { path: { id } },
    }),
  );
}

export async function rejectProposal(api: Client<paths>, id: string) {
  return unwrap(
    await api.POST("/assistant/proposals/{id}/reject", {
      params: { path: { id } },
    }),
  );
}

export async function deleteConversation(api: Client<paths>, id: string) {
  await unwrap(
    await api.DELETE("/assistant/conversations/{id}", {
      params: { path: { id } },
    }),
  );
}

export async function deleteConversations(api: Client<paths>) {
  await unwrap(await api.DELETE("/assistant/conversations"));
}

function useApiMutation<V, R>(fn: (api: Client<paths>, vars: V) => Promise<R>) {
  const api = useApi();
  return useMutation({ mutationFn: (vars: V) => fn(api, vars) });
}

export const useConfirmProposal = () => useApiMutation(confirmProposal);
export const useRejectProposal = () => useApiMutation(rejectProposal);
export const useDeleteConversation = () => useApiMutation(deleteConversation);
export function useDeleteConversations() {
  const api = useApi();
  return useMutation({ mutationFn: () => deleteConversations(api) });
}

// The turn is a Server-Sent Events stream, which the generated client does not read.
export async function sendMessage(
  input: { conversationId?: string; text: string; page?: string },
  onEvent: (e: AssistantEvent) => void,
  signal: AbortSignal,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<void> {
  const body = JSON.stringify({
    conversation_id: input.conversationId,
    text: input.text,
    page: input.page,
  });
  const response = await fetchImpl("/api/v1/assistant/turns", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  });
  if (response.status !== 200) {
    const parsed: unknown = await response.json().catch(() => undefined);
    onEvent({
      type: "error",
      problem: parseProblem(response.status, parsed),
    });
    return;
  }
  if (response.body === null) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let carry = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const parsed = parseEvents(decoder.decode(value, { stream: true }), carry);
    carry = parsed.carry;
    for (const event of parsed.events) onEvent(event);
  }
}
