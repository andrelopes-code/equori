import {
  Bubble,
  BubbleContent,
  Message,
  MessageBody,
} from "@slotted/react/message";
import { Stack } from "@slotted/react/stack";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AnswerCopy } from "@/features/assistant/answer-copy";
import { parseAnswer } from "@/features/assistant/answer-markdown";
import { assistantKeys } from "@/features/assistant/api";
import styles from "@/features/assistant/assistant-panel.module.css";
import { ConfirmAll } from "@/features/assistant/confirm-all";
import type { Decision } from "@/features/assistant/confirm-all";
import { maskAmounts, maskMatch } from "@/features/assistant/mask-amounts";
import { MessageAnswer } from "@/features/assistant/message-answer";
import { MessageUnanswered } from "@/features/assistant/message-unanswered";
import { ProposalCard } from "@/features/assistant/proposal-card";
import type { AssistantMessage } from "@/features/assistant/sse";
import { TurnActivity } from "@/features/assistant/turn-activity";
import { useT } from "@/i18n/i18n-provider";
import { usePrivacy } from "@/privacy/privacy-provider";
import { FormNotice } from "@/ui/form-notice";

interface MessageItemProps {
  message: AssistantMessage;
  // The stored conversation, refetched after a decision so a promoted card shows its preview.
  conversationId?: string | undefined;
  onRetry?: (() => void) | undefined;
  // The steps of the turn that produced this answer, when this session saw it.
  steps?: string[] | undefined;
  // The answer just arrived; its last card brings its actions into view (P13).
  reveal?: boolean;
  // The answer is still arriving; it has nothing to copy yet.
  streaming?: boolean;
}

export function MessageItem({
  message,
  conversationId,
  onRetry,
  steps,
  reveal = false,
  streaming = false,
}: MessageItemProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const { hidden } = usePrivacy();

  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [running, setRunning] = useState(false);

  const own = message.role === "user";
  const open = message.proposals.filter(
    (p) =>
      (p.status === "pending" || p.status === "waiting") &&
      decisions[p.id] === undefined,
  );
  const lastOpen = open.at(-1)?.id;
  const tree = useMemo(() => {
    if (own || message.content === "") return null;
    const parsed = parseAnswer(message.content);
    return hidden ? maskAmounts(parsed, maskMatch) : parsed;
  }, [own, message.content, hidden]);

  function handleDecided(id: string, decision: Decision) {
    setDecisions((d) => ({ ...d, [id]: decision }));
    if (conversationId !== undefined)
      void queryClient.invalidateQueries({
        queryKey: assistantKeys.conversation(conversationId),
      });
  }

  if (message.outcome === "failed" || message.outcome === "canceled") {
    return <MessageUnanswered outcome={message.outcome} onRetry={onRetry} />;
  }

  return (
    <Message align={own ? "end" : "start"}>
      <MessageBody>
        {steps !== undefined && <TurnActivity steps={steps} running={false} />}
        {own && (
          <Bubble>
            <BubbleContent>{message.content}</BubbleContent>
          </Bubble>
        )}
        {!own && <MessageAnswer tree={tree} />}
        {(message.outcome === "step_limit" || message.proposals.length > 0) && (
          <Stack gap={3} className={styles.attached}>
            {message.outcome === "step_limit" && (
              <FormNotice tone="warning">
                {t("assistant.step_limit")}
              </FormNotice>
            )}
            {message.proposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                siblings={message.proposals}
                reveal={reveal && proposal.id === lastOpen}
                decision={decisions[proposal.id]}
                locked={running}
                onDecided={handleDecided}
              />
            ))}
            <ConfirmAll
              proposals={open}
              onDecided={handleDecided}
              onRunning={setRunning}
            />
          </Stack>
        )}
        {!own && tree !== null && !streaming && (
          <AnswerCopy content={message.content} />
        )}
      </MessageBody>
    </Message>
  );
}
