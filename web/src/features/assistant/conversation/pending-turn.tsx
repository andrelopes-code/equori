import {
  Bubble,
  BubbleTyping,
  Message,
  MessageBody,
} from "@slotted/react/message";
import { MessageScrollerItem } from "@slotted/react/message-scroller";

import type { AssistantFile } from "@/features/assistant/api";
import { MessageItem } from "@/features/assistant/message/message-item";
import { UserMessage } from "@/features/assistant/message/user-message";
import { AssistantTurn } from "@/features/assistant/message/assistant-turn";
import { TurnActivity } from "@/features/assistant/message/turn-activity";
import { useFrameValue } from "@/features/assistant/conversation/use-frame-value";

interface PendingTurnProps {
  question: string;
  files: AssistantFile[];
  steps: string[];
  // The answer's text since the last step (E4).
  answer: string;
}

// The running turn: the question sent, then its steps or a typing bubble, then the answer so far.
export function PendingTurn({
  question,
  files,
  steps,
  answer,
}: PendingTurnProps) {
  const framed = useFrameValue(answer);

  // A step clears the text at once (E4); only its growth waits for a frame.
  const draft = answer === "" ? "" : framed;

  return (
    <>
      <MessageScrollerItem messageId="pending" anchor>
        <UserMessage text={question} files={files} />
      </MessageScrollerItem>

      {(steps.length > 0 || draft === "") && (
        <Message status="streaming">
          <MessageBody>
            <AssistantTurn thinking>
              {steps.length > 0 ? (
                <TurnActivity steps={steps} running />
              ) : (
                <Bubble>
                  <BubbleTyping />
                </Bubble>
              )}
            </AssistantTurn>
          </MessageBody>
        </Message>
      )}

      {draft !== "" && (
        <MessageItem
          message={{
            id: "draft",
            role: "assistant",
            content: draft,
            created_at: "",
            proposals: [],
            files: [],
          }}
          streaming
        />
      )}
    </>
  );
}
