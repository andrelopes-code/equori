import { useSyncExternalStore } from "react";

import type { components } from "@/api/schema.gen";
import {
  chosenTarget,
  readStoredChoice,
  subscribeStoredChoice,
} from "@/features/assistant/model/chat-target";
import type { ChatTarget } from "@/features/assistant/model/chat-target";

type Chat = components["schemas"]["AssistantChat"];

// The target the reader chose for the next turns, when the chat still offers it (MC5).
export function useChatTarget(chat: Chat | undefined): ChatTarget | undefined {
  const stored = useSyncExternalStore(
    subscribeStoredChoice,
    readStoredChoice,
    () => null,
  );

  return chosenTarget(chat, stored);
}
