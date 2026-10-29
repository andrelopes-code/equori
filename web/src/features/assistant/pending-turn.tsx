import {
  Bubble,
  BubbleContent,
  BubbleTyping,
  Message,
  MessageBody,
} from "@slotted/react/message";
import { MessageScrollerItem } from "@slotted/react/message-scroller";

import { MessageItem } from "@/features/assistant/message-item";
import { TurnActivity } from "@/features/assistant/turn-activity";
import { useFrameValue } from "@/features/assistant/use-frame-value";

interface PendingTurnProps {
  question: string;
  steps: string[];
  // The answer's text since the last step (E4).
  answer: string;
}

// The running turn: the question sent, then its steps or a typing bubble, then the answer so far.
export function PendingTurn({ question, steps, answer }: PendingTurnProps) {
  const framed = useFrameValue(answer);

  // A step clears the text at once (E4); only its growth waits for a frame.
  const draft = answer === "" ? "" : framed;

  return (
    <>
      <MessageScrollerItem messageId="pending" anchor>
        <Message align="end">
          <MessageBody>
            <Bubble>
              <BubbleContent>{question}</BubbleContent>
            </Bubble>
          </MessageBody>
        </Message>
      </MessageScrollerItem>

      {(steps.length > 0 || draft === "") && (
        <Message status="streaming">
          <MessageBody>
            {steps.length > 0 ? (
              <TurnActivity steps={steps} running />
            ) : (
              <Bubble>
                <BubbleTyping />
              </Bubble>
            )}
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
          }}
          streaming
        />
      )}
    </>
  );
}
