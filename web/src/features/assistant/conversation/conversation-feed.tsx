import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@slotted/react/message-scroller";

import styles from "@/features/assistant/panel/assistant-panel.module.css";
import { MessageItem } from "@/features/assistant/message/message-item";
import { PendingTurn } from "@/features/assistant/conversation/pending-turn";
import type { AssistantMessage } from "@/features/assistant/model/sse";
import type { AssistantTurn } from "@/features/assistant/conversation/use-assistant-turn";

interface ConversationFeedProps {
  messages: readonly AssistantMessage[];
  turn: AssistantTurn;
  // The last message is a question the server stored without any answer.
  orphan: boolean;
  onRetry: (() => void) | undefined;
}

// The stored messages, an unanswered question's failed answer, and the running turn.
export function ConversationFeed({
  messages,
  turn,
  orphan,
  onRetry,
}: ConversationFeedProps) {
  const last = messages.at(-1);

  return (
    <MessageScroller follow defaultPosition="end" busy={turn.pending !== null}>
      <MessageScrollerViewport>
        <MessageScrollerContent className={styles.feed}>
          {messages.map((m) => (
            <MessageScrollerItem
              key={m.id}
              messageId={m.id}
              anchor={m.role === "user"}
            >
              <MessageItem
                message={m}
                conversationId={turn.conversationId}
                onRetry={m === last && !orphan ? onRetry : undefined}
                steps={turn.activity[m.id]}
                reveal={
                  m === last && m.proposals.some((p) => p.status === "pending")
                }
              />
            </MessageScrollerItem>
          ))}

          {orphan && last !== undefined && (
            <MessageScrollerItem messageId="unanswered">
              <MessageItem
                message={{
                  id: "unanswered",
                  role: "assistant",
                  content: "",
                  outcome: turn.stopped ? "canceled" : "failed",
                  created_at: last.created_at,
                  proposals: [],
                  files: [],
                }}
                onRetry={onRetry}
              />
            </MessageScrollerItem>
          )}

          {turn.pending !== null && (
            <PendingTurn
              question={turn.pending}
              files={turn.pendingFiles}
              steps={turn.steps}
              answer={turn.draft}
            />
          )}
        </MessageScrollerContent>
      </MessageScrollerViewport>
    </MessageScroller>
  );
}
