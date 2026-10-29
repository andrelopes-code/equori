import type { AssistantTurn } from "@/features/assistant/use-assistant-turn";
import { maskAmountText } from "@/features/assistant/mask-amounts";
import { useT } from "@/i18n/i18n-provider";
import { usePrivacy } from "@/privacy/privacy-provider";

// The line under the panel's heading: the list, a new conversation or the open conversation's name.
export function usePanelTitle(
  listing: boolean,
  stored: { title?: string } | undefined,
  turn: AssistantTurn,
): string {
  const t = useT();
  const { hidden } = usePrivacy();

  if (listing) return t("assistant.conversations");

  // While the first turn runs, the conversation is named after the question (U13).
  const name =
    stored === undefined && turn.pending !== null
      ? turn.pending
      : stored?.title;

  const fresh = turn.conversationId === undefined && turn.pending === null;
  if (name === undefined || fresh) return t("assistant.new_conversation");

  return hidden ? maskAmountText(name) : name;
}
