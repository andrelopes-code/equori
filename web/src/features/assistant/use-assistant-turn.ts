import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { assistantKeys, sendMessage } from "@/features/assistant/api";
import type {
  AssistantEvent,
  AssistantProblem,
} from "@/features/assistant/sse";

export interface AssistantTurn {
  conversationId: string | undefined;
  // The text of the message being answered, shown until the stored conversation holds it.
  pending: string | null;
  step: string | null;
  error: AssistantProblem | null;
  send: (text: string) => void;
  open: (id: string) => void;
  reset: () => void;
}

export function useAssistantTurn(page: string): AssistantTurn {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string>();
  const [pending, setPending] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<AssistantProblem | null>(null);
  const abort = useRef<AbortController | null>(null);
  const current = useRef<string>(undefined);

  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    current.current = undefined;
    setConversationId(undefined);
    setPending(null);
    setStep(null);
    setError(null);
  }, []);

  const open = useCallback(
    (id: string) => {
      reset();
      current.current = id;
      setConversationId(id);
    },
    [reset],
  );

  const send = useCallback(
    (text: string) => {
      const controller = new AbortController();
      abort.current = controller;
      setPending(text);
      setStep(null);
      setError(null);
      const onEvent = (event: AssistantEvent) => {
        if (event.type === "turn") {
          current.current = event.conversationId;
          setConversationId(event.conversationId);
        } else if (event.type === "step") {
          setStep(event.tool);
        } else if (event.type === "error") {
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
            setStep(null);
          }
        });
    },
    [page, queryClient],
  );

  return { conversationId, pending, step, error, send, open, reset };
}
