import {
  Bubble,
  BubbleContent,
  Message,
  MessageBody,
} from "@slotted/react/message";

import type { AssistantFile } from "@/features/assistant/api";
import { SentFiles } from "@/features/assistant/message/sent-files";

interface UserMessageProps {
  text: string;
  files: AssistantFile[];
}

// Families read: message. A message of the member: its files above its text; a message of files
// alone draws no bubble (F2, FU5).
export function UserMessage({ text, files }: UserMessageProps) {
  return (
    <Message align="end">
      <MessageBody>
        <SentFiles files={files} />
        {text !== "" && (
          <Bubble variant="soft" tone="accent">
            <BubbleContent>{text}</BubbleContent>
          </Bubble>
        )}
      </MessageBody>
    </Message>
  );
}
