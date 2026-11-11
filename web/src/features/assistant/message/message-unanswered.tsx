import { Message, MessageBody } from "@slotted/react/message";
import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

interface MessageUnansweredProps {
  outcome: "failed" | "canceled";
  onRetry?: (() => void) | undefined;
}

// A turn that ended without an answer: why, and a retry when the caller offers one.
export function MessageUnanswered({
  outcome,
  onRetry,
}: MessageUnansweredProps) {
  const t = useT();

  const reason =
    outcome === "failed" ? "assistant.no_answer" : "assistant.canceled";

  return (
    <Message align="start">
      <MessageBody>
        <Stack gap={2} align="start">
          <Text size="sm" tone="muted">
            {t(reason)}
          </Text>
          {onRetry !== undefined && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t("assistant.retry")}
            </Button>
          )}
        </Stack>
      </MessageBody>
    </Message>
  );
}
