import { Message, MessageBody } from "@slotted/react/message";
import { Stack } from "@slotted/react/stack";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AnswerCopy } from "@/features/assistant/message/answer-copy";
import { parseAnswer } from "@/features/assistant/message/answer-markdown";
import { AssistantTurn } from "@/features/assistant/message/assistant-turn";
import { assistantKeys } from "@/features/assistant/api";
import styles from "@/features/assistant/panel/assistant-panel.module.css";
import { DecisionSheet } from "@/features/assistant/proposal/decision-sheet";
import {
  maskAmounts,
  maskMatch,
} from "@/features/assistant/model/mask-amounts";
import { MessageAnswer } from "@/features/assistant/message/message-answer";
import { MessageUnanswered } from "@/features/assistant/message/message-unanswered";
import { isReceipt } from "@/features/assistant/proposal/proposal-card-state";
import { Receipt } from "@/features/assistant/proposal/receipt";
import { ResultBlock } from "@/features/assistant/proposal/result-block";
import { useAnswerSheet } from "@/features/assistant/proposal/use-answer-sheet";
import type { Decision } from "@/features/assistant/proposal/use-sheet-decisions";
import type { AssistantMessage } from "@/features/assistant/model/sse";
import { TurnActivity } from "@/features/assistant/message/turn-activity";
import { UserMessage } from "@/features/assistant/message/user-message";
import { AnswerView } from "@/features/assistant/view/answer-view";
import { useT } from "@/i18n/i18n-provider";
import { usePrivacy } from "@/privacy/privacy-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

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
  // An undo shows on the proposal it reverses, not as a card of its own (V19).
  const proposals = message.proposals.filter((p) => p.undoes === undefined);
  const sheet = useAnswerSheet(proposals, decisions);

  const own = message.role === "user";
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

  if (own) {
    return <UserMessage text={message.content} files={message.files} />;
  }

  return (
    <Message align="start">
      <MessageBody>
        <AssistantTurn thinking={false}>
          {steps !== undefined && (
            <TurnActivity steps={steps} running={false} />
          )}

          <MessageAnswer tree={tree} />

          {message.views.map((view) => (
            <AnswerView key={view.id} view={view} />
          ))}

          {(message.outcome === "step_limit" || proposals.length > 0) && (
            <Stack gap={3} className={styles.attached}>
              {message.outcome === "step_limit" && (
                <FormNotice tone="warning">
                  {t("assistant.step_limit")}
                </FormNotice>
              )}
              <DecisionSheet
                rows={sheet.rows}
                deadline={sheet.deadline}
                now={sheet.now}
                siblings={proposals}
                reveal={reveal}
                onDecided={handleDecided}
              />
              {sheet.results.map((proposal) =>
                isReceipt(proposal) ? (
                  <Receipt key={proposal.id} proposal={proposal} />
                ) : (
                  <ResultBlock key={proposal.id} proposal={proposal} />
                ),
              )}
            </Stack>
          )}

          {tree !== null && !streaming && (
            <AnswerCopy content={message.content} />
          )}
        </AssistantTurn>
      </MessageBody>
    </Message>
  );
}
