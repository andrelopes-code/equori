import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import type { components } from "@/api/schema.gen";
import { assistantKeys, sendMessage } from "@/features/assistant/api";
import {
  readOpenConversation,
  writeOpenConversation,
} from "@/features/assistant/open-conversation";
import type {
  AssistantEvent,
  AssistantMessage,
  AssistantProblem,
} from "@/features/assistant/sse";

type ConversationDetail = components["schemas"]["AssistantConversationDetail"];

export interface AssistantTurn {
  conversationId: string | undefined;
  // The text of the message being answered, shown until the stored conversation holds it.
  pending: string | null;
  // The steps of the running turn, in order (P5).
  steps: string[];
  // The steps of each answer this session received, by answer message ID.
  activity: Record<string, string[]>;
  // The answer's text since the last step (E4).
  draft: string;
  error: AssistantProblem | null;
  send: (text: string) => void;
  stop: () => void;
  open: (id: string) => void;
  reset: () => void;
}

export function useAssistantTurn(page: string): AssistantTurn {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState(readOpenConversation);
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [activity, setActivity] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<AssistantProblem | null>(null);
  const abort = useRef<AbortController | null>(null);
  const current = useRef(conversationId);

  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    current.current = undefined;
    writeOpenConversation(undefined);
    setConversationId(undefined);
    setPending(null);
    setDraft("");
    setSteps([]);
    setError(null);
  }, []);

  const stop = useCallback(() => {
    abort.current?.abort();
  }, []);

  const open = useCallback(
    (id: string) => {
      reset();
      current.current = id;
      writeOpenConversation(id);
      setConversationId(id);
    },
    [reset],
  );

  const send = useCallback(
    (text: string) => {
      const controller = new AbortController();
      abort.current = controller;
      setPending(text);
      setDraft("");
      setSteps([]);
      setError(null);
      let userMessageId = "";
      const turnSteps: string[] = [];
      const onEvent = (event: AssistantEvent) => {
        if (event.type === "turn") {
          current.current = event.conversationId;
          writeOpenConversation(event.conversationId);
          userMessageId = event.messageId;
          setConversationId(event.conversationId);
        } else if (event.type === "delta") {
          setDraft((d) => d + event.text);
        } else if (event.type === "step") {
          setDraft("");
          turnSteps.push(event.tool);
          setSteps([...turnSteps]);
        } else if (event.type === "answer") {
          const id = current.current;
          if (id === undefined) return;
          // The answer is shown from the event; the refetch that follows only confirms it (P1).
          const now = new Date().toISOString();
          const user: AssistantMessage = {
            id: userMessageId,
            role: "user",
            content: text,
            created_at: now,
            proposals: [],
          };
          queryClient.setQueryData<ConversationDetail>(
            assistantKeys.conversation(id),
            (old) =>
              old === undefined
                ? {
                    id,
                    title: text,
                    created_at: now,
                    updated_at: now,
                    messages: [user, event.message],
                  }
                : { ...old, messages: [...old.messages, user, event.message] },
          );
          if (turnSteps.length > 0) {
            const answerId = event.message.id;
            setActivity((a) => ({ ...a, [answerId]: [...turnSteps] }));
          }
          if (abort.current === controller) {
            setPending(null);
            setDraft("");
            setSteps([]);
          }
        } else {
          setError(event.problem);
        }
      };
      void sendMessage(
        {
          text,
          page,
          ...(current.current === undefined
            ? {}
            : { conversationId: current.current }),
        },
        onEvent,
        controller.signal,
      )
        .catch(() => {
          // An aborted or broken stream ends the turn; the stored conversation is the source of truth.
        })
        .then(() =>
          queryClient.invalidateQueries({ queryKey: assistantKeys.all }),
        )
        .finally(() => {
          if (abort.current === controller) {
            setPending(null);
            setDraft("");
            setSteps([]);
          }
        });
    },
    [page, queryClient],
  );

  return {
    conversationId,
    pending,
    steps,
    activity,
    draft,
    error,
    send,
    stop,
    open,
    reset,
  };
}
